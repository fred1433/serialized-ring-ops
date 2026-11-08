import { Inject, Injectable } from '@nestjs/common';
import { Clock } from '../clock';
import { Db } from '../db';
import { logEvent } from '../events';

export interface PaidOrder {
  provider: 'stripe' | 'shopify';
  eventId: string;
  channelRef: string;
  customer: string;
}

export interface IntakeResult {
  orderId: number;
  duplicate: boolean;
}

@Injectable()
export class OrderIntakeService {
  constructor(
    @Inject(Db) private readonly db: Db,
    @Inject(Clock) private readonly clock: Clock,
  ) {}

  /**
   * Two simultaneous deliveries of one event wait on the same unique key: the second
   * sees the first one's committed order and adds nothing.
   */
  async recordPaid(input: PaidOrder): Promise<IntakeResult> {
    const at = this.clock.now();
    return this.db.tx(async (tx) => {
      const created = await tx.query<{ id: number }>(
        `insert into orders (channel, channel_ref, customer, paid_at) values ($1, $2, $3, $4)
         on conflict (channel, channel_ref) do nothing returning id`,
        [input.provider, input.channelRef, input.customer, at],
      );
      if (created.rowCount === 1) {
        const orderId = created.rows[0].id;
        await tx.query('insert into webhook_deliveries (provider, event_id, order_id) values ($1, $2, $3)', [
          input.provider,
          input.eventId,
          orderId,
        ]);
        await logEvent(tx, { at, kind: 'order', actor: input.provider, orderId, detail: `Paid order from ${input.provider}` });
        return { orderId, duplicate: false };
      }
      const existing = await tx.query<{ id: number }>('select id from orders where channel = $1 and channel_ref = $2', [
        input.provider,
        input.channelRef,
      ]);
      return { orderId: existing.rows[0].id, duplicate: true };
    });
  }
}
