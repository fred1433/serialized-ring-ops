import { BadRequestException, Controller, Headers, Inject, Post, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import Stripe from 'stripe';
import { IntakeResult, OrderIntakeService } from './order-intake.service';

// Test secrets for local replay only. Real ones would come from the environment.
export const STRIPE_TEST_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_local_replay_only';
export const SHOPIFY_TEST_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET ?? 'shopify_local_replay_only';

const stripe = new Stripe('sk_test_local_replay_only');

export function shopifySignature(body: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64');
}

export function stripeTestHeader(payload: string, secret: string = STRIPE_TEST_SECRET): string {
  return stripe.webhooks.generateTestHeaderString({ payload, secret });
}

function sameSignature(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

@Controller('webhooks')
export class WebhookController {
  constructor(@Inject(OrderIntakeService) private readonly intake: OrderIntakeService) {}

  @Post('stripe')
  async stripeEvent(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string): Promise<IntakeResult | { ignored: string }> {
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody as Buffer, signature, STRIPE_TEST_SECRET);
    } catch {
      throw new UnauthorizedException('Signature does not match this body');
    }
    if (event.type !== 'checkout.session.completed') return { ignored: event.type };
    const session = event.data.object as Stripe.Checkout.Session;
    return this.intake.recordPaid({
      provider: 'stripe',
      eventId: event.id,
      channelRef: session.id,
      customer: session.customer_details?.name ?? 'Unnamed customer',
    });
  }

  @Post('shopify')
  async shopifyEvent(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-shopify-hmac-sha256') signature: string | undefined,
    @Headers('x-shopify-webhook-id') webhookId: string | undefined,
    @Headers('x-shopify-topic') topic: string | undefined,
  ): Promise<IntakeResult | { ignored: string }> {
    const expected = shopifySignature(req.rawBody as Buffer, SHOPIFY_TEST_SECRET);
    if (!signature || !sameSignature(signature, expected)) throw new UnauthorizedException('Signature does not match this body');
    if (!webhookId) throw new BadRequestException('Missing webhook ID');
    if (topic !== 'orders/paid') return { ignored: String(topic) };
    const order = req.body as { id: number; customer?: { first_name?: string } };
    return this.intake.recordPaid({
      provider: 'shopify',
      eventId: webhookId,
      channelRef: String(order.id),
      customer: order.customer?.first_name ?? 'Unnamed customer',
    });
  }
}
