import { FakeCarrier, FakePrinter } from '../channels/fake-providers';
import { Clock } from '../clock';
import { Db } from '../db';
import { PackingService, Slip } from '../packing/packing.service';
import { HistoryEntry, ScanUnit, WhyAnswer } from '../shared';
import { BRAND, CUSTOMERS, PACKER, RING_FAILED, RING_OK, RING_OTHER } from './seed';

export interface DemoRing extends ScanUnit {
  lot: string;
  size: number;
  intakeAt: string;
  status: string;
}

export interface DemoState {
  brand: string;
  packer: string;
  slip: Slip;
  shipTo: { name: string; street: string; city: string };
  rings: DemoRing[];
  why: WhyAnswer;
  history: HistoryEntry[];
  reservations: { orderId: number; uuid: string }[];
  waiting: { orderId: number; submittedAt: string }[];
}

const iso = (value: unknown): string => new Date(value as string).toISOString();

/** Reads the page's data out of PostgreSQL after the real services have run the seed. */
export async function readDemoState(db: Db, orderId = 104): Promise<DemoState> {
  const packing = new PackingService(db, new Clock(), new FakeCarrier(), new FakePrinter());
  const slip = await packing.slip(orderId);
  const rows = await db.query<{ uuid: string; qa: ScanUnit['qa']; lot: string; size: number; intake_at: Date; status: string; reserved_for: number | null }>(
    `select u.uuid, u.qa, u.lot, u.size, u.intake_at, u.status,
            (select r.order_id from reservations r where r.unit_uuid = u.uuid and r.active) as reserved_for
       from units u where u.uuid = any($1::uuid[])`,
    [[RING_OTHER, RING_FAILED, RING_OK]],
  );
  const onBench = [RING_OTHER, RING_FAILED, RING_OK];
  const rings = rows
    .map((r) => ({
      uuid: r.uuid,
      qa: r.qa,
      reservedFor: r.reserved_for,
      lot: r.lot,
      size: r.size,
      intakeAt: iso(r.intake_at),
      status: r.status,
    }))
    .sort((a, b) => onBench.indexOf(a.uuid) - onBench.indexOf(b.uuid));
  const reservations = await db.query<{ orderId: number; uuid: string }>(
    `select order_id as "orderId", unit_uuid as uuid from reservations where active order by order_id`,
  );
  const waiting = await db.query<{ orderId: number; submittedAt: Date }>(
    `select r.order_id as "orderId", r.submitted_at as "submittedAt" from size_requests r
      where not exists (select 1 from reservations x where x.order_id = r.order_id and x.active)
      order by r.rank`,
  );
  const why = await packing.why(orderId);
  return {
    brand: BRAND,
    packer: PACKER,
    slip: {
      ...slip,
      sizeSubmittedAt: iso(slip.sizeSubmittedAt),
      labelCreatedAt: iso(slip.labelCreatedAt),
      sizerDeliveredAt: iso(slip.sizerDeliveredAt),
    },
    shipTo: CUSTOMERS[orderId],
    rings,
    why,
    history: why.history,
    reservations,
    waiting: waiting.map((w) => ({ orderId: w.orderId, submittedAt: iso(w.submittedAt) })),
  };
}
