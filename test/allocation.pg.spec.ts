import { Db, migrate, resetDb } from '../src/db';
import { DEFAULT_DATABASE_URL } from '../src/db';
import { canMove } from '../src/inventory/unit-states';
import { addOrder, addRing, services, uuidOf } from './support/app';
import {
  cancelHandsOver,
  forcedOrder,
  InvertedAllocator,
  openRace,
  ORDER_A,
  ORDER_B,
  outcome,
  rightWinner,
  rollbackRelease,
  stockOrder,
} from './support/scenarios';

describe('ring attribution on PostgreSQL', () => {
  const db = new Db();
  afterAll(() => db.close());

  it('forced order: B\'s connection moves first, A registered first, A gets the ring', async () => {
    const o = await forcedOrder(db);
    expect(o).toEqual({ holders: [ORDER_A], activeReservations: 1, waiting: [ORDER_B] });
    expect(rightWinner(o)).toBe(true);
  });

  it('witness: the same test fails on every run when the queue is read backwards', async () => {
    for (let run = 0; run < 5; run += 1) {
      const o = await forcedOrder(db, new InvertedAllocator());
      expect(o.holders).toEqual([ORDER_B]);
      expect(rightWinner(o)).toBe(false);
    }
  });

  it('stock order: the oldest eligible ring goes out, not the older one that failed QA', async () => {
    const { given, oldestEligible, failed } = await stockOrder(db);
    expect(given).toBe(oldestEligible);
    expect(given).not.toBe(failed);
  });

  it('same intake date: the tie breaks on the UUID, the same way every time', async () => {
    for (let run = 0; run < 3; run += 1) {
      await resetDb(db);
      const s = services(db);
      await addRing(s, uuidOf(9), '2026-10-10T08:00:00Z');
      await addRing(s, uuidOf(4), '2026-10-10T08:00:00Z');
      await addOrder(db, ORDER_A);
      const [assignment] = await s.reservations.submitSize(ORDER_A, 8);
      expect(assignment.uuid).toBe(uuidOf(4));
    }
  });

  it('release: after the lock holder rolls back, the waiter looks again and serves the ring', async () => {
    const o = await rollbackRelease(db);
    expect(o).toEqual({ holders: [ORDER_A], activeReservations: 1, waiting: [] });
  });

  it('cancel: A cancels and B gets the ring without sending its size again', async () => {
    const o = await cancelHandsOver(db);
    expect(o).toEqual({ holders: [ORDER_B], activeReservations: 1, waiting: [] });
  });

  it('cancel is atomic: a failure after the release leaves A reserved and B waiting, with nothing between', async () => {
    await resetDb(db);
    const s = services(db);
    const ring = uuidOf(1);
    await addRing(s, ring, '2026-11-01T08:00:00Z');
    await addOrder(db, ORDER_A);
    await addOrder(db, ORDER_B);
    await s.reservations.submitSize(ORDER_A, 8);
    await s.reservations.submitSize(ORDER_B, 8);
    // The handover to B is the next insert after the release: make that insert stall, then fail.
    await db.pool.query(`
      create function forced_failure() returns trigger language plpgsql as $$
      begin perform pg_sleep(0.3); raise exception 'forced failure'; end $$;
      create trigger forced_failure before insert on reservations for each row execute function forced_failure();
    `);
    const cancelling = s.reservations.cancel(ORDER_A).then(
      () => 'committed',
      (error: Error) => error.message,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    const seenDuring = await outcome(db, ring);
    expect(await cancelling).toBe('forced failure');
    await db.pool.query('drop trigger forced_failure on reservations');
    const seenAfter = await outcome(db, ring);
    const expected = { holders: [ORDER_A], activeReservations: 1, waiting: [ORDER_B] };
    expect(seenDuring).toEqual(expected);
    expect(seenAfter).toEqual(expected);
    const [order] = await db.query(`select status from orders where id = $1`, [ORDER_A]);
    expect(order.status).toBe('open');
    const [unit] = await db.query(`select status from units where uuid = $1`, [ring]);
    expect(unit.status).toBe('reserved');
  });

  it('open race: twelve orders, one ring, one reservation, held by the oldest request', async () => {
    const o = await openRace(db);
    expect(o.activeReservations).toBe(1);
    const [first] = await db.query<{ order_id: number }>('select order_id from size_requests order by rank limit 1');
    expect(o.holders).toEqual([first.order_id]);
    expect(o.waiting).toHaveLength(11);
  });

  it('paid without a size: nothing is reserved until the size arrives', async () => {
    await resetDb(db);
    const s = services(db);
    const ring = uuidOf(1);
    await addRing(s, ring, '2026-11-01T08:00:00Z');
    await addOrder(db, ORDER_A);
    expect((await outcome(db, ring)).activeReservations).toBe(0);
    await s.reservations.submitSize(ORDER_A, 8);
    expect((await outcome(db, ring)).holders).toEqual([ORDER_A]);
  });

  it('a waiting order gets the next ring as soon as it passes QA', async () => {
    await resetDb(db);
    const s = services(db);
    await addOrder(db, ORDER_A);
    expect(await s.reservations.submitSize(ORDER_A, 8)).toEqual([]);
    const ring = uuidOf(2);
    await addRing(s, ring, '2026-11-01T08:00:00Z');
    expect((await outcome(db, ring)).holders).toEqual([ORDER_A]);
  });

  it('a size 7 order does not take a size 8 ring', async () => {
    await resetDb(db);
    const s = services(db);
    const ring = uuidOf(1);
    await addRing(s, ring, '2026-11-01T08:00:00Z', 'passed', 8);
    await addOrder(db, ORDER_A);
    expect(await s.reservations.submitSize(ORDER_A, 7)).toEqual([]);
    expect((await outcome(db, ring)).activeReservations).toBe(0);
  });

  it('two active reservations on one ring are impossible at the database level', async () => {
    await resetDb(db);
    const s = services(db);
    const ring = uuidOf(1);
    await addRing(s, ring, '2026-11-01T08:00:00Z');
    await addOrder(db, ORDER_A);
    await addOrder(db, ORDER_B);
    await s.reservations.submitSize(ORDER_A, 8);
    await expect(
      db.pool.query(`insert into reservations (order_id, unit_uuid, reserved_at) values ($1, $2, now())`, [ORDER_B, ring]),
    ).rejects.toThrow(/one_active_reservation_per_unit/);
  });

  it('refuses bad sizes, unknown orders, a second size and cancelled orders', async () => {
    await resetDb(db);
    const s = services(db);
    await addOrder(db, ORDER_A);
    await expect(s.reservations.submitSize(ORDER_A, 2)).rejects.toThrow(/whole number/);
    await expect(s.reservations.submitSize(ORDER_A, 8.5)).rejects.toThrow(/whole number/);
    await expect(s.reservations.submitSize(ORDER_A, 16)).rejects.toThrow(/whole number/);
    await expect(s.reservations.submitSize(9999, 8)).rejects.toThrow(/No such order/);
    await s.reservations.submitSize(ORDER_A, 8);
    await expect(s.reservations.submitSize(ORDER_A, 8)).rejects.toThrow(/already has a size/);
    await expect(s.reservations.cancel(9999)).rejects.toThrow(/No such order/);
    await s.reservations.cancel(ORDER_A);
    await expect(s.reservations.cancel(ORDER_A)).rejects.toThrow(/already cancelled/);
    await expect(s.reservations.recordSize(ORDER_A, 8)).rejects.toThrow(/cancelled/);
  });

  it('cancelling an order that never sent a size releases nothing', async () => {
    await resetDb(db);
    const s = services(db);
    await addOrder(db, ORDER_A);
    await expect(s.reservations.cancel(ORDER_A)).resolves.toEqual([]);
  });

  it('a validated parcel cannot be cancelled', async () => {
    await resetDb(db);
    const s = services(db);
    const ring = uuidOf(1);
    await addRing(s, ring, '2026-11-01T08:00:00Z');
    await addOrder(db, ORDER_A);
    await s.reservations.submitSize(ORDER_A, 8);
    await s.packing.scan(ORDER_A, ring, 'test');
    await expect(s.reservations.cancel(ORDER_A)).rejects.toThrow(/already validated/);
  });

  it('state table refuses a skipped step', () => {
    expect(canMove('manifested', 'reserved')).toBe(false);
    expect(canMove('qa_failed', 'available')).toBe(false);
    expect(canMove('reserved', 'packed')).toBe(true);
  });

  it('migrate creates the tables once and leaves them after that', async () => {
    await db.pool.query('drop schema public cascade; create schema public;');
    await expect(migrate(db)).resolves.toBe(true);
    await expect(migrate(db)).resolves.toBe(false);
  });

  it('has a default local address', () => {
    expect(DEFAULT_DATABASE_URL).toContain('ring_ops');
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const local = new Db();
    expect((local.pool as unknown as { options: { connectionString: string } }).options.connectionString).toBe(DEFAULT_DATABASE_URL);
    process.env.DATABASE_URL = saved;
    return local.close();
  });
});
