import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { CARRIER, CarrierPort, PRINTER, PrinterPort } from '../channels/fake-providers';
import { Clock } from '../clock';
import { Db } from '../db';
import { logEvent } from '../events';
import { moveUnit } from '../inventory/unit-states';
import { checkScan, explainWhy, HistoryEntry, ScanOutcome, ScanUnit, WhyAnswer } from '../shared';

export interface Slip {
  orderId: number;
  customer: string;
  size: number | null;
  sizeSubmittedAt: string | null;
  expectedUuid: string | null;
  lot: string | null;
  labelCreatedAt: string | null;
  validatedAt: string | null;
  handedOffAt: string | null;
  deliveredAt: string | null;
  sizerDeliveredAt: string | null;
}

@Injectable()
export class PackingService {
  constructor(
    @Inject(Db) private readonly db: Db,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(CARRIER) private readonly carrier: CarrierPort,
    @Inject(PRINTER) private readonly printer: PrinterPort,
  ) {}

  /** The slip doubles as the pick list: which ring, from which lot, for which order. */
  async slip(orderId: number): Promise<Slip> {
    const [row] = await this.db.query<Slip>(
      `select o.id as "orderId", o.customer, q.size, q.submitted_at as "sizeSubmittedAt",
              r.unit_uuid as "expectedUuid", u.lot,
              p.label_created_at as "labelCreatedAt", p.validated_at as "validatedAt",
              p.handed_off_at as "handedOffAt", p.delivered_at as "deliveredAt",
              s.delivered_at as "sizerDeliveredAt"
         from orders o
         left join size_requests q on q.order_id = o.id
         left join reservations r on r.order_id = o.id and r.active
         left join units u on u.uuid = r.unit_uuid
         left join parcels p on p.order_id = o.id
         left join sizer_parcels s on s.order_id = o.id
        where o.id = $1`,
      [orderId],
    );
    if (!row) throw new NotFoundException('No such order');
    return row;
  }

  async scan(orderId: number, input: string, actor: string): Promise<ScanOutcome> {
    const at = this.clock.now();
    return this.db.tx(async (tx) => {
      const order = await tx.query('select id from orders where id = $1 for update', [orderId]);
      if (order.rowCount === 0) throw new NotFoundException('No such order');
      const reservation = await tx.query<{ unit_uuid: string }>(
        'select unit_uuid from reservations where order_id = $1 and active',
        [orderId],
      );
      const expectedUuid = reservation.rows[0]?.unit_uuid ?? null;
      const parcel = await tx.query('select 1 from parcels where order_id = $1 and validated_at is not null', [orderId]);
      const units = await this.loadUnit(tx, input);
      const decision = checkScan(input, { id: orderId, expectedUuid, validated: parcel.rowCount === 1 }, units);
      const scanned = input.trim().toLowerCase();
      if (decision.outcome === 'blocked') {
        await logEvent(tx, {
          at,
          kind: 'scan_refused',
          actor,
          orderId,
          unitUuid: scanned,
          reason: decision.reason,
          detail: decision.message,
        });
      } else if (decision.outcome === 'already-validated') {
        await logEvent(tx, { at, kind: 'scan_repeated', actor, orderId, unitUuid: scanned, detail: decision.message });
      } else {
        await moveUnit(tx, scanned, 'packed');
        await tx.query(
          `insert into parcels (order_id, unit_uuid, validated_at) values ($1, $2, $3)
           on conflict (order_id) do update set unit_uuid = excluded.unit_uuid, validated_at = excluded.validated_at`,
          [orderId, scanned, at],
        );
        await logEvent(tx, { at, kind: 'scan_accepted', actor, orderId, unitUuid: scanned, detail: decision.message });
      }
      return decision;
    });
  }

  private async loadUnit(tx: PoolClient, input: string): Promise<ScanUnit[]> {
    const { rows } = await tx.query<{ uuid: string; qa: ScanUnit['qa']; reserved_for: number | null }>(
      `select u.uuid, u.qa,
              (select r.order_id from reservations r where r.unit_uuid = u.uuid and r.active) as reserved_for
         from units u where u.uuid::text = $1`,
      [input.trim().toLowerCase()],
    );
    return rows.map((u) => ({ uuid: u.uuid, qa: u.qa, reservedFor: u.reserved_for }));
  }

  /** A label may exist before the scan. A wrong scan blocks the parcel, not the label. */
  async createLabel(orderId: number, actor: string): Promise<string> {
    const at = this.clock.now();
    const slip = await this.slip(orderId);
    const label = await this.carrier.createLabel(orderId);
    await this.printer.print(label.url);
    await this.db.tx(async (tx) => {
      await tx.query(
        `insert into parcels (order_id, label_created_at) values ($1, $2)
         on conflict (order_id) do update set label_created_at = excluded.label_created_at`,
        [slip.orderId, at],
      );
      await logEvent(tx, { at, kind: 'label', actor, orderId, detail: `Ring label created (${label.provider})` });
    });
    return label.url;
  }

  async handOff(orderId: number, actor: string): Promise<void> {
    const at = this.clock.now();
    await this.db.tx(async (tx) => {
      const unit = await this.parcelUnit(tx, orderId, 'validated_at', 'Parcel is not validated');
      const label = await tx.query('select 1 from parcels where order_id = $1 and label_created_at is not null', [orderId]);
      if (label.rowCount === 0) throw new ConflictException('Parcel has no label');
      await moveUnit(tx, unit, 'handed_off');
      await tx.query('update parcels set handed_off_at = $2 where order_id = $1', [orderId, at]);
      await logEvent(tx, { at, kind: 'handoff', actor, orderId, unitUuid: unit, detail: 'Handed to carrier (simulated)' });
    });
  }

  async ringDelivered(orderId: number): Promise<void> {
    const at = this.clock.now();
    await this.db.tx(async (tx) => {
      const unit = await this.parcelUnit(tx, orderId, 'handed_off_at', 'Parcel was not handed to a carrier');
      await moveUnit(tx, unit, 'delivered');
      await tx.query('update parcels set delivered_at = $2 where order_id = $1', [orderId, at]);
      await logEvent(tx, { at, kind: 'delivered', actor: 'carrier', orderId, unitUuid: unit, detail: 'Ring delivered (simulated)' });
    });
  }

  /** The sizer travels alone. This writes to the sizer's table and leaves the ring's parcel untouched. */
  async sizerDelivered(orderId: number): Promise<void> {
    const at = this.clock.now();
    await this.db.tx(async (tx) => {
      const order = await tx.query('select 1 from orders where id = $1', [orderId]);
      if (order.rowCount === 0) throw new NotFoundException('No such order');
      await tx.query(
        `insert into sizer_parcels (order_id, delivered_at) values ($1, $2)
         on conflict (order_id) do update set delivered_at = excluded.delivered_at`,
        [orderId, at],
      );
      await logEvent(tx, { at, kind: 'sizer_delivered', actor: 'carrier', orderId, detail: 'Sizer delivered (simulated)' });
    });
  }

  /** Eligibility only. Bluetooth pairing is out of scope and nothing here talks to a ring. */
  async pairCheck(uuid: string): Promise<{ eligible: boolean; status: string }> {
    const [unit] = await this.db.query<{ status: string }>('select status from units where uuid = $1', [uuid]);
    if (!unit) throw new NotFoundException('No ring with that ID');
    return { eligible: unit.status === 'delivered', status: unit.status };
  }

  async history(uuid: string): Promise<HistoryEntry[]> {
    const rows = await this.db.query<{ at: Date; kind: string; actor: string; detail: string }>(
      `select at, kind, actor, detail from packing_events where unit_uuid = $1 order by at asc, id asc`,
      [uuid],
    );
    return rows.map((r) => ({ at: r.at.toISOString(), kind: r.kind, actor: r.actor, detail: r.detail }));
  }

  /** The ring's own lines, plus the order's size request, which came before any ring was attached to it. */
  private async packingHistory(uuid: string, orderId: number): Promise<HistoryEntry[]> {
    const rows = await this.db.query<{ at: Date; kind: string; actor: string; detail: string }>(
      `select at, kind, actor, detail from packing_events
        where unit_uuid = $1 or (order_id = $2 and kind = 'size')
        order by at asc, id asc`,
      [uuid, orderId],
    );
    return rows.map((r) => ({ at: r.at.toISOString(), kind: r.kind, actor: r.actor, detail: r.detail }));
  }

  async why(orderId: number): Promise<WhyAnswer> {
    const slip = await this.slip(orderId);
    if (!slip.expectedUuid) throw new ConflictException(`Order ${orderId} has no ring reserved`);
    const [{ left }] = await this.db.query<{ left: number }>(
      `select count(*)::int as left from units where size = $1 and status = 'available' and qa = 'passed'`,
      [slip.size],
    );
    const waiting = await this.db.query<{ orderId: number; submittedAt: Date }>(
      `select r.order_id as "orderId", r.submitted_at as "submittedAt"
         from size_requests r join orders o on o.id = r.order_id
        where r.size = $1 and o.status = 'open'
          and not exists (select 1 from reservations x where x.order_id = r.order_id and x.active)
        order by r.rank asc`,
      [slip.size],
    );
    return explainWhy({
      orderId,
      size: slip.size as number,
      uuid: slip.expectedUuid,
      submittedAt: new Date(slip.sizeSubmittedAt as string).toISOString(),
      history: await this.packingHistory(slip.expectedUuid, orderId),
      eligibleLeft: left,
      waiting: waiting.map((w) => ({ orderId: w.orderId, submittedAt: w.submittedAt.toISOString() })),
    });
  }

  private async parcelUnit(tx: PoolClient, orderId: number, column: 'validated_at' | 'handed_off_at', refusal: string): Promise<string> {
    const { rows } = await tx.query<{ unit_uuid: string }>(
      `select unit_uuid from parcels where order_id = $1 and ${column} is not null for update`,
      [orderId],
    );
    if (!rows[0]) throw new ConflictException(refusal);
    return rows[0].unit_uuid;
  }
}

