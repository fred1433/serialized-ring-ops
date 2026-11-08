// Requests fired together on one order, repeated. FUZZ_RUNS sets how many times.
import { Db, resetDb } from '../src/db';
import { addOrder, addRing, services, Services, uuidOf } from './support/app';
import { ORDER_A, ORDER_B, violations } from './support/scenarios';

const RUNS = Number(process.env.FUZZ_RUNS ?? 15);
const ORDER_C = 503;
const RING = uuidOf(1);

async function ring(s: Services): Promise<void> {
  await addRing(s, RING, '2026-11-01T08:00:00Z');
}

const cases: [string, (s: Services, db: Db) => Promise<Promise<unknown>[]>][] = [
  [
    'size, cancel and another size',
    async (s) => {
      await ring(s);
      return [s.reservations.submitSize(ORDER_A, 8), s.reservations.cancel(ORDER_A), s.reservations.submitSize(ORDER_B, 8)];
    },
  ],
  [
    'cancel twice while another order waits',
    async (s) => {
      await ring(s);
      await s.reservations.submitSize(ORDER_A, 8);
      await s.reservations.submitSize(ORDER_B, 8);
      return [s.reservations.cancel(ORDER_A), s.reservations.cancel(ORDER_A)];
    },
  ],
  [
    'cancel while a new ring passes QA',
    async (s) => {
      await ring(s);
      await s.reservations.submitSize(ORDER_A, 8);
      await s.reservations.submitSize(ORDER_B, 8);
      await s.manifests.importCsv(`uuid,size,lot\n${uuidOf(2)},8,L-T\n`, 'test');
      await s.manifests.intakeScan(uuidOf(2), 'test');
      return [s.reservations.cancel(ORDER_A), s.manifests.recordQa(uuidOf(2), 'passed', 'test')];
    },
  ],
  [
    'cancel against the packing scan',
    async (s) => {
      await ring(s);
      await s.reservations.submitSize(ORDER_A, 8);
      await s.reservations.submitSize(ORDER_B, 8);
      return [s.reservations.cancel(ORDER_A), s.packing.scan(ORDER_A, RING, 'test')];
    },
  ],
  [
    'two cancels and a late size',
    async (s) => {
      await ring(s);
      await s.reservations.submitSize(ORDER_A, 8);
      await s.reservations.submitSize(ORDER_B, 8);
      return [s.reservations.cancel(ORDER_A), s.reservations.cancel(ORDER_B), s.reservations.submitSize(ORDER_C, 8)];
    },
  ],
];

describe('requests racing on one order', () => {
  const db = new Db();
  afterAll(() => db.close());

  it.each(cases)('%s: nothing left stuck', async (_name, arrange) => {
    for (let run = 0; run < RUNS; run += 1) {
      await resetDb(db);
      const s = services(db);
      for (const id of [ORDER_A, ORDER_B, ORDER_C]) await addOrder(db, id);
      const results = await Promise.allSettled(await arrange(s, db));
      const deadlocks = results.filter((r) => r.status === 'rejected' && /deadlock/.test(String(r.reason)));
      expect(deadlocks).toEqual([]);
      expect(await violations(db)).toEqual([]);
    }
  }, 600000);

  it('the checks do catch a stuck ring', async () => {
    await resetDb(db);
    const s = services(db);
    await ring(s);
    await addOrder(db, ORDER_A);
    await s.reservations.recordSize(ORDER_A, 8);
    expect(await violations(db)).toEqual(['free ring while an order waits']);
    await s.reservations.submitSize(ORDER_B, 7).catch(() => undefined);
    await db.pool.query(`update orders set status = 'cancelled' where id = $1`, [ORDER_A]);
    await db.tx((tx) => s.allocator.serve(tx, 8, new Date()));
    await db.pool.query(`insert into orders (id, channel, channel_ref, customer, paid_at) values (999, 't', 'r', 'T', now())`);
    await db.pool.query(`insert into reservations (order_id, unit_uuid, reserved_at) values ($1, $2, now())`, [ORDER_A, RING]);
    expect(await violations(db)).toEqual(['cancelled order holds a ring', 'ring marked available while reserved']);
    await db.pool.query(`update reservations set active = false`);
    await db.pool.query(`update units set status = 'reserved' where uuid = $1`, [RING]);
    expect(await violations(db)).toEqual(['ring marked reserved with no reservation']);
  });
});
