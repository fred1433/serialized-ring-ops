import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Clock } from '../clock';
import { Db } from '../db';
import { logEvent } from '../events';

export interface ChannelOrder {
  provider: 'stripe' | 'shopify';
  eventId: string;
  channelRef: string;
  customer: string;
  paid: boolean;
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
   * Two simultaneous deliveries of one event wait on the delivery's primary key: the second
   * sees the first one's committed work and adds nothing. A checkout that completes unpaid
   * creates the order without a payment date, and a later event on it can supply one.
   */
  async record(input: ChannelOrder): Promise<IntakeResult> {
    const at = this.clock.now();
    return this.db.tx(async (tx) => {
      const delivery = await tx.query(
        'insert into webhook_deliveries (provider, event_id) values ($1, $2) on conflict do nothing returning event_id',
        [input.provider, input.eventId],
      );
      if (delivery.rowCount === 0) return this.seenBefore(tx, input);

      const created = await tx.query<{ id: number }>(
        `insert into orders (channel, channel_ref, customer, paid_at) values ($1, $2, $3, $4)
         on conflict (channel, channel_ref) do nothing returning id`,
        [input.provider, input.channelRef, input.customer, input.paid ? at : null],
      );
      const result = created.rows[0]
        ? await this.logNewOrder(tx, created.rows[0].id, input, at)
        : await this.updateExisting(tx, input, at);
      await tx.query('update webhook_deliveries set order_id = $3 where provider = $1 and event_id = $2', [
        input.provider,
        input.eventId,
        result.orderId,
      ]);
      return result;
    });
  }

  private async seenBefore(tx: Tx, input: ChannelOrder): Promise<IntakeResult> {
    const { rows } = await tx.query<{ id: number; channel_ref: string }>(
      `select o.id, o.channel_ref from webhook_deliveries d join orders o on o.id = d.order_id
        where d.provider = $1 and d.event_id = $2`,
      [input.provider, input.eventId],
    );
    if (rows[0].channel_ref !== input.channelRef) {
      throw new ConflictException('This webhook ID was already used for another order');
    }
    return { orderId: rows[0].id, duplicate: true };
  }

  private async logNewOrder(tx: Tx, orderId: number, input: ChannelOrder, at: Date): Promise<IntakeResult> {
    await logEvent(tx, {
      at,
      kind: 'order',
      actor: input.provider,
      orderId,
      detail: input.paid ? `Paid order from ${input.provider}` : `Unpaid order from ${input.provider}, waiting for payment`,
    });
    return { orderId, duplicate: false };
  }

  private async updateExisting(tx: Tx, input: ChannelOrder, at: Date): Promise<IntakeResult> {
    const { rows } = await tx.query<{ id: number; paid_at: Date | null }>(
      'select id, paid_at from orders where channel = $1 and channel_ref = $2 for no key update',
      [input.provider, input.channelRef],
    );
    const [{ id: orderId, paid_at: paidAt }] = rows;
    if (!input.paid || paidAt !== null) return { orderId, duplicate: true };
    await tx.query('update orders set paid_at = $2 where id = $1', [orderId, at]);
    await logEvent(tx, { at, kind: 'paid', actor: input.provider, orderId, detail: `Payment confirmed by ${input.provider}` });
    return { orderId, duplicate: false };
  }
}

type Tx = Parameters<Parameters<Db['tx']>[0]>[0];
