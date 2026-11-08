import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Clock } from '../clock';
import { Db } from '../db';
import { logEvent } from '../events';
import { moveUnit } from '../inventory/unit-states';
import { Allocator, Assignment, lockSize } from './allocator';

@Injectable()
export class ReservationService {
  constructor(
    @Inject(Db) private readonly db: Db,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(Allocator) private readonly allocator: Allocator,
  ) {}

  /** Writes the request and takes its rank under the size lock. Reserves nothing. */
  async recordSize(orderId: number, size: number): Promise<number> {
    if (!Number.isInteger(size) || size < 3 || size > 15) throw new BadRequestException('Size must be a whole number from 3 to 15');
    const at = this.clock.now();
    return this.db.tx(async (tx) => {
      // Same lock order as cancel: the order row, then the size. NO KEY UPDATE, because attribution
      // takes KEY SHARE on the order through the reservation's foreign key and must not wait on this.
      const order = await tx.query<{ status: string; paid_at: Date | null }>(
        'select status, paid_at from orders where id = $1 for no key update',
        [orderId],
      );
      if (!order.rows[0]) throw new NotFoundException('No such order');
      if (order.rows[0].status !== 'open') throw new ConflictException('Order is cancelled');
      if (order.rows[0].paid_at === null) throw new ConflictException('Order is not paid yet');
      await lockSize(tx, size);
      const inserted = await tx.query<{ rank: string }>(
        `insert into size_requests (order_id, size, submitted_at) values ($1, $2, $3)
         on conflict (order_id) do nothing returning rank`,
        [orderId, size, at],
      );
      if (inserted.rowCount === 0) throw new ConflictException('This order already has a size');
      await logEvent(tx, { at, kind: 'size', actor: 'customer', orderId, detail: `Size ${size} submitted` });
      return Number(inserted.rows[0].rank);
    });
  }

  /** The customer's size form: a durable request first, then a separate attribution pass. */
  async submitSize(orderId: number, size: number): Promise<Assignment[]> {
    await this.recordSize(orderId, size);
    return this.db.tx((tx) => this.allocator.serve(tx, size, this.clock.now()));
  }

  /** Releasing the ring and handing it to the next order happen in one transaction, or not at all. */
  async cancel(orderId: number): Promise<Assignment[]> {
    const at = this.clock.now();
    return this.db.tx(async (tx) => {
      const found = await tx.query<{ status: string }>('select status from orders where id = $1 for no key update', [orderId]);
      if (!found.rows[0]) throw new NotFoundException('No such order');
      if (found.rows[0].status !== 'open') throw new ConflictException('Order is already cancelled');
      // Read only now: with the row held, a size sent at the same moment is either committed or refused.
      const request = await tx.query<{ size: number }>('select size from size_requests where order_id = $1', [orderId]);
      const size = request.rows[0]?.size ?? null;
      if (size !== null) await lockSize(tx, size);
      const packed = await tx.query('select 1 from parcels where order_id = $1 and validated_at is not null', [orderId]);
      if (packed.rowCount === 1) throw new ConflictException('This parcel is already validated');
      await tx.query(`update orders set status = 'cancelled' where id = $1`, [orderId]);
      const released = await tx.query<{ unit_uuid: string }>(
        `update reservations set active = false, released_at = $2
          where order_id = $1 and active returning unit_uuid`,
        [orderId, at],
      );
      await logEvent(tx, { at, kind: 'cancelled', actor: 'customer', orderId, detail: 'Order cancelled' });
      if (released.rowCount === 0) return [];
      const uuid = released.rows[0].unit_uuid;
      await moveUnit(tx, uuid, 'available');
      await logEvent(tx, { at, kind: 'released', actor: 'system', orderId, unitUuid: uuid, detail: 'Reservation released' });
      return this.allocator.serve(tx, size as number, at);
    });
  }
}
