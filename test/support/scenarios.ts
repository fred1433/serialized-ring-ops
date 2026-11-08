// The race scenarios. The Jest suite and scripts/race-report.ts run this same code,
// so the numbers in reports/race-report.json come from what the tests check.
import { Allocator } from '../../src/allocation/allocator';
import { Db, resetDb } from '../../src/db';
import { addOrder, addRing, services, uuidOf } from './app';

// Test orders. They are not the fictional orders on the page's slip.
export const ORDER_A = 501;
export const ORDER_B = 502;
export const NOW = new Date('2026-11-05T12:00:00Z');

/** Same SQL, same locks, with the queue read backwards. Exists only to prove the test can fail. */
export class InvertedAllocator extends Allocator {
  protected readonly requestOrder = 'desc' as const;
}

export interface Outcome {
  holders: number[];
  activeReservations: number;
  waiting: number[];
}

export async function outcome(db: Db, uuid: string): Promise<Outcome> {
  const holders = await db.query<{ order_id: number }>(`select order_id from reservations where active and unit_uuid = $1`, [uuid]);
  const waiting = await db.query<{ order_id: number }>(
    `select r.order_id from size_requests r join orders o on o.id = r.order_id
      where o.status = 'open' and not exists (select 1 from reservations x where x.order_id = r.order_id and x.active)
      order by r.rank`,
  );
  return {
    holders: holders.map((h) => h.order_id),
    activeReservations: holders.length,
    waiting: waiting.map((w) => w.order_id),
  };
}

/** Polls until another backend sits waiting on a lock, so a step cannot run ahead by luck. */
export async function waitForLockWaiter(db: Db, event = '%'): Promise<void> {
  for (let i = 0; i < 500; i += 1) {
    const [{ n }] = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_stat_activity
        where wait_event_type = 'Lock' and wait_event like $1 and datname = current_database()`,
      [event],
    );
    if (n > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('No backend ever waited on the lock');
}

/** A registers before B. B's connection takes the size lock first. A's connection waits behind it. */
export async function forcedOrder(db: Db, allocator: Allocator = new Allocator()): Promise<Outcome> {
  await resetDb(db);
  const s = services(db, allocator);
  const ring = uuidOf(1);
  await addRing(s, ring, '2026-11-01T08:00:00Z');
  await addOrder(db, ORDER_A);
  await addOrder(db, ORDER_B);
  await s.reservations.recordSize(ORDER_A, 8);
  await s.reservations.recordSize(ORDER_B, 8);

  const connectionB = await db.pool.connect();
  await connectionB.query('begin');
  await allocator.serve(connectionB, 8, NOW);
  const connectionA = db.tx((tx) => allocator.serve(tx, 8, NOW));
  await waitForLockWaiter(db);
  await connectionB.query('commit');
  connectionB.release();
  await connectionA;
  return outcome(db, ring);
}

export function rightWinner(o: Outcome): boolean {
  return o.activeReservations === 1 && o.holders[0] === ORDER_A && o.waiting.length === 1 && o.waiting[0] === ORDER_B;
}

/** Two eligible rings of different dates, and an older one that failed QA. */
export async function stockOrder(db: Db): Promise<{ given: string; oldestEligible: string; failed: string }> {
  await resetDb(db);
  const s = services(db);
  const failed = uuidOf(1);
  const oldestEligible = uuidOf(2);
  const newer = uuidOf(3);
  await addRing(s, failed, '2026-10-01T08:00:00Z', 'failed');
  await addRing(s, newer, '2026-10-20T08:00:00Z');
  await addRing(s, oldestEligible, '2026-10-10T08:00:00Z');
  await addOrder(db, ORDER_A);
  const [assignment] = await s.reservations.submitSize(ORDER_A, 8);
  return { given: assignment.uuid, oldestEligible, failed };
}

/** The lock holder rolls back while another connection waits. The waiter must look again and find the ring free. */
export async function rollbackRelease(db: Db): Promise<Outcome> {
  await resetDb(db);
  const s = services(db);
  const ring = uuidOf(1);
  await addRing(s, ring, '2026-11-01T08:00:00Z');
  await addOrder(db, ORDER_A);
  await s.reservations.recordSize(ORDER_A, 8);

  const holder = await db.pool.connect();
  await holder.query('begin');
  await s.allocator.serve(holder, 8, NOW);
  const waiter = db.tx((tx) => s.allocator.serve(tx, 8, NOW));
  await waitForLockWaiter(db);
  await holder.query('rollback');
  holder.release();
  await waiter;
  return outcome(db, ring);
}

/** A holds the ring and B waits. A cancels, and B gets it without sending anything again. */
export async function cancelHandsOver(db: Db): Promise<Outcome> {
  await resetDb(db);
  const s = services(db);
  const ring = uuidOf(1);
  await addRing(s, ring, '2026-11-01T08:00:00Z');
  await addOrder(db, ORDER_A);
  await addOrder(db, ORDER_B);
  await s.reservations.submitSize(ORDER_A, 8);
  await s.reservations.submitSize(ORDER_B, 8);
  await s.reservations.cancel(ORDER_A);
  return outcome(db, ring);
}

/** Many orders hit one ring with no forced order at all. */
export async function openRace(db: Db, orders = 12): Promise<Outcome> {
  await resetDb(db);
  const s = services(db);
  const ring = uuidOf(1);
  await addRing(s, ring, '2026-11-01T08:00:00Z');
  const ids = Array.from({ length: orders }, (_, i) => 600 + i);
  for (const id of ids) await addOrder(db, id);
  await Promise.all(ids.map((id) => s.reservations.submitSize(id, 8)));
  return outcome(db, ring);
}

/** What must never be true once every request has answered. */
export async function violations(db: Db): Promise<string[]> {
  const found: string[] = [];
  const count = async (sql: string) => (await db.query<{ n: number }>(sql))[0].n;
  if (await count(`select count(*)::int as n from reservations r join orders o on o.id = r.order_id where r.active and o.status = 'cancelled'`)) {
    found.push('cancelled order holds a ring');
  }
  if (await count(`select count(*)::int as n from units u where u.status = 'reserved' and not exists (select 1 from reservations r where r.unit_uuid = u.uuid and r.active)`)) {
    found.push('ring marked reserved with no reservation');
  }
  if (await count(`select count(*)::int as n from reservations r join units u on u.uuid = r.unit_uuid where r.active and u.status = 'available'`)) {
    found.push('ring marked available while reserved');
  }
  if (
    await count(`select count(*)::int as n from size_requests q join orders o on o.id = q.order_id
      join units u on u.size = q.size and u.status = 'available' and u.qa = 'passed'
      where o.status = 'open' and not exists (select 1 from reservations r where r.order_id = q.order_id and r.active)`)
  ) {
    found.push('free ring while an order waits');
  }
  return found;
}

export interface OrderRequests {
  size(orderId: number, size: number): Promise<unknown>;
  cancel(orderId: number): Promise<unknown>;
}

/** A size and a cancel on one order at the same moment, with another order also asking for the one ring. */
export async function sizeAgainstCancel(db: Db, send: OrderRequests): Promise<string[]> {
  await resetDb(db);
  const s = services(db);
  await addRing(s, uuidOf(1), '2026-11-01T08:00:00Z');
  await addOrder(db, ORDER_A);
  await addOrder(db, ORDER_B);
  await Promise.allSettled([send.size(ORDER_A, 8), send.cancel(ORDER_A), send.size(ORDER_B, 8)]);
  return violations(db);
}
