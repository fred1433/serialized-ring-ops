import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { logEvent } from '../events';
import { moveUnit } from '../inventory/unit-states';
import { orderLabel } from '../shared';

const SIZE_LOCK_NAMESPACE = 8008;

/** One lock per ring size, held until the transaction ends. */
export async function lockSize(tx: PoolClient, size: number): Promise<void> {
  await tx.query('select pg_advisory_xact_lock($1, $2)', [SIZE_LOCK_NAMESPACE, size]);
}

export interface Assignment {
  orderId: number;
  uuid: string;
}

@Injectable()
export class Allocator {
  /** Which waiting request is served first. The witness test flips this and nothing else. */
  protected readonly requestOrder: 'asc' | 'desc' = 'asc';

  /**
   * Serves waiting requests for one size. It does not matter whose connection runs
   * this: the oldest request gets the oldest eligible ring, not the caller.
   */
  async serve(tx: PoolClient, size: number, at: Date): Promise<Assignment[]> {
    await lockSize(tx, size);
    const assignments: Assignment[] = [];
    for (;;) {
      const request = await tx.query<{ order_id: number }>(
        `select r.order_id from size_requests r
           join orders o on o.id = r.order_id
          where r.size = $1 and o.status = 'open'
            and not exists (select 1 from reservations x where x.order_id = r.order_id and x.active)
          order by r.rank ${this.requestOrder}
          limit 1`,
        [size],
      );
      if (request.rowCount === 0) return assignments;
      const unit = await tx.query<{ uuid: string }>(
        `select uuid from units
          where size = $1 and status = 'available' and qa = 'passed'
          order by intake_at asc, uuid asc
          limit 1
          for update`,
        [size],
      );
      if (unit.rowCount === 0) return assignments;
      const orderId = request.rows[0].order_id;
      const uuid = unit.rows[0].uuid;
      await moveUnit(tx, uuid, 'reserved');
      await tx.query('insert into reservations (order_id, unit_uuid, reserved_at) values ($1, $2, $3)', [orderId, uuid, at]);
      await logEvent(tx, {
        at,
        kind: 'reserved',
        actor: 'system',
        orderId,
        unitUuid: uuid,
        detail: `Reserved for order ${orderLabel(orderId)}`,
      });
      assignments.push({ orderId, uuid });
    }
  }
}
