import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { shopifySignature, SHOPIFY_TEST_SECRET, stripeTestHeader } from '../src/channels/webhook.controller';
import { Db, resetDb } from '../src/db';
import { PACKER, RING_OK, RING_OTHER, seedDemo } from '../src/seed/seed';
import { uuidOf } from './support/app';

describe('HTTP API', () => {
  let app: INestApplication;
  let db: Db;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ rawBody: true });
    await app.init();
    db = app.get(Db);
  });
  beforeEach(async () => {
    await resetDb(db);
    await seedDemo(db);
  });
  afterAll(async () => {
    await db.close();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const orderCount = async () => (await db.query<{ n: number }>('select count(*)::int as n from orders'))[0].n;

  it('walks one ring from manifest to pair-check', async () => {
    const ring = uuidOf(11);
    await http().post('/manifests').send({ csv: `uuid,size,lot\n${ring},9,L-9\n` }).expect(201);
    await http().post(`/units/${ring}/intake`).send({}).expect(201);
    await http().post(`/units/${ring}/qa`).send({ result: 'passed', actor: PACKER }).expect(201);
    await db.pool.query(`insert into orders (id, channel, channel_ref, customer, paid_at) values (300, 'test', 'r300', 'T', now())`);
    const assigned = await http().post('/orders/300/size').send({ size: 9 }).expect(201);
    expect(assigned.body).toEqual([{ orderId: 300, uuid: ring }]);
    const slip = await http().get('/orders/300/slip').expect(200);
    expect(slip.body).toMatchObject({ expectedUuid: ring, lot: 'L-9', size: 9 });
    await http().post('/orders/300/label').send({}).expect(201);
    const scan = await http().post('/orders/300/scan').send({ ringId: ring }).expect(201);
    expect(scan.body.message).toBe('Ready for carrier handoff');
    await http().post('/orders/300/sizer-delivered').expect(201);
    await http().post('/orders/300/handoff').send({}).expect(201);
    await http().post('/orders/300/delivered').expect(201);
    expect((await http().get(`/units/${ring}/pair-check`).expect(200)).body.eligible).toBe(true);
    const history = await http().get(`/units/${ring}/history`).expect(200);
    expect(history.body.map((h: { kind: string }) => h.kind)).toEqual([
      'manifest', 'intake', 'qa', 'reserved', 'scan_accepted', 'handoff', 'delivered',
    ]);
  });

  it('answers the wrong scan and why this ring', async () => {
    const res = await http().post('/orders/104/scan').send({ ringId: RING_OTHER, actor: PACKER }).expect(201);
    expect(res.body.message).toBe('Packing blocked. Ring …3A90 belongs to order #099. Expected …7C21.');
    const why = await http().get('/orders/104/why').expect(200);
    expect(why.body.line).toContain('…7C21');
  });

  it('cancel over HTTP hands the ring to the waiting order', async () => {
    await http().post('/orders/104/cancel').expect(201);
    expect((await http().get('/orders/105/slip').expect(200)).body.expectedUuid).toBe(RING_OK);
  });

  it('refuses missing and malformed input', async () => {
    await http().post('/manifests').send({}).expect(400);
    await http().post('/manifests').send({ csv: '   ' }).expect(400);
    await http().post('/orders/104/scan').send({}).expect(400);
    await http().post('/orders/104/scan').expect(400);
    await http().post(`/units/${RING_OK}/qa`).send({ result: 'maybe' }).expect(400);
    await http().post(`/units/${RING_OK}/qa`).send({}).expect(400);
    await http().post('/units/not-a-uuid/intake').send({}).expect(400);
    await http().get('/units/not-a-uuid/history').expect(400);
    await http().get('/orders/abc/slip').expect(400);
    await http().post('/orders/104/size').send({}).expect(400);
    await http().get('/orders/9999/slip').expect(404);
    await http().get('/orders/105/why').expect(409);
  });

  describe('Stripe webhook, replayed locally with a test signature', () => {
    const payload = (eventId: string, sessionId: string, type = 'checkout.session.completed', name: string | null = 'Test Buyer') =>
      JSON.stringify({
        id: eventId,
        object: 'event',
        type,
        data: { object: { id: sessionId, customer_details: name ? { name } : null } },
      });
    const send = (body: string, signature = stripeTestHeader(body)) =>
      http().post('/webhooks/stripe').set('content-type', 'application/json').set('stripe-signature', signature).send(body);

    it('creates one order from a signed event', async () => {
      const res = await send(payload('evt_1', 'cs_1')).expect(201);
      expect(res.body.duplicate).toBe(false);
      const [order] = await db.query(`select customer, channel from orders where id = $1`, [res.body.orderId]);
      expect(order).toEqual({ customer: 'Test Buyer', channel: 'stripe' });
    });

    it('refuses an altered body', async () => {
      const signed = payload('evt_2', 'cs_2');
      await send(payload('evt_2', 'cs_TAMPERED'), stripeTestHeader(signed)).expect(401);
      expect(await orderCount()).toBe(3);
    });

    it('refuses a signature made with the wrong secret', async () => {
      const body = payload('evt_3', 'cs_3');
      await send(body, stripeTestHeader(body, 'whsec_wrong')).expect(401);
    });

    it('two simultaneous deliveries of one event give one order', async () => {
      const body = payload('evt_4', 'cs_4');
      const [a, b] = await Promise.all([send(body).expect(201), send(body).expect(201)]);
      expect(a.body.orderId).toBe(b.body.orderId);
      expect([a.body.duplicate, b.body.duplicate].sort()).toEqual([false, true]);
      expect(await orderCount()).toBe(4);
    });

    it('ignores other event types and tolerates a missing name', async () => {
      const ignored = await send(payload('evt_5', 'cs_5', 'invoice.paid')).expect(201);
      expect(ignored.body).toEqual({ ignored: 'invoice.paid' });
      const res = await send(payload('evt_6', 'cs_6', 'checkout.session.completed', null)).expect(201);
      const [order] = await db.query('select customer from orders where id = $1', [res.body.orderId]);
      expect(order.customer).toBe('Unnamed customer');
    });
  });

  describe('Shopify webhook, replayed locally with a test signature', () => {
    const body = (id: number, customer?: object) => JSON.stringify({ id, customer });
    const send = (raw: string, signature: string | null = shopifySignature(raw, SHOPIFY_TEST_SECRET), webhookId: string | null = `wh-${raw}`, topic = 'orders/paid') => {
      const req = http().post('/webhooks/shopify').set('content-type', 'application/json').set('x-shopify-topic', topic);
      if (signature) req.set('x-shopify-hmac-sha256', signature);
      if (webhookId) req.set('x-shopify-webhook-id', webhookId);
      return req.send(raw);
    };

    it('creates one order, and two simultaneous deliveries still give one', async () => {
      const raw = body(55, { first_name: 'Sam' });
      const [a, b] = await Promise.all([send(raw).expect(201), send(raw).expect(201)]);
      expect(a.body.orderId).toBe(b.body.orderId);
      expect(await orderCount()).toBe(4);
    });

    it('refuses an altered body, a missing signature and a signature of another length', async () => {
      await send(body(56), shopifySignature(body(57), SHOPIFY_TEST_SECRET)).expect(401);
      await send(body(56), null).expect(401);
      await send(body(56), 'short').expect(401);
      expect(await orderCount()).toBe(3);
    });

    it('requires a webhook ID and ignores other topics', async () => {
      await send(body(58), undefined, null).expect(400);
      const ignored = await send(body(59), undefined, 'wh-59', 'orders/create').expect(201);
      expect(ignored.body).toEqual({ ignored: 'orders/create' });
    });

    it('tolerates an order with no customer', async () => {
      const res = await send(body(60)).expect(201);
      const [order] = await db.query('select customer from orders where id = $1', [res.body.orderId]);
      expect(order.customer).toBe('Unnamed customer');
    });
  });
});
