// Replays the race scenarios on the PostgreSQL in DATABASE_URL and records what happened.
// The page prints this file and nothing else about concurrency.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import 'reflect-metadata';
import { Db } from '../src/db';
import {
  cancelHandsOver,
  forcedOrder,
  InvertedAllocator,
  openRace,
  ORDER_A,
  ORDER_B,
  rightWinner,
  rollbackRelease,
  stockOrder,
} from '../test/support/scenarios';

const RUNS = Number(process.env.RACE_RUNS ?? 50);

function headCommit(): string {
  const root = join(__dirname, '..', '.git');
  if (!existsSync(join(root, 'HEAD'))) return 'unknown';
  const head = readFileSync(join(root, 'HEAD'), 'utf8').trim();
  if (!head.startsWith('ref: ')) return head;
  const ref = head.slice(5);
  const loose = join(root, ref);
  if (existsSync(loose)) return readFileSync(loose, 'utf8').trim();
  const packed = readFileSync(join(root, 'packed-refs'), 'utf8').split('\n').find((line) => line.endsWith(` ${ref}`));
  return packed ? packed.split(' ')[0] : 'unknown';
}

async function count(runs: number, trial: () => Promise<boolean>): Promise<number> {
  let held = 0;
  for (let i = 0; i < runs; i += 1) if (await trial()) held += 1;
  return held;
}

async function main(): Promise<void> {
  const db = new Db();
  const [{ version }] = await db.query<{ version: string }>('show server_version');
  const scenarios = [
    {
      key: 'forced_order',
      title: 'The later order\'s connection moves first',
      expectation: 'The earlier order gets the ring, the later one waits, one reservation exists.',
      passed: await count(RUNS, async () => rightWinner(await forcedOrder(db))),
    },
    {
      key: 'stock_order',
      title: 'Older ring failed QA, two eligible rings of different dates',
      expectation: 'The older of the two eligible rings is given.',
      passed: await count(RUNS, async () => {
        const r = await stockOrder(db);
        return r.given === r.oldestEligible;
      }),
    },
    {
      key: 'rollback_release',
      title: 'The lock holder rolls back while another connection waits',
      expectation: 'The waiting connection looks again and serves the ring.',
      passed: await count(RUNS, async () => {
        const o = await rollbackRelease(db);
        return o.activeReservations === 1 && o.holders[0] === ORDER_A;
      }),
    },
    {
      key: 'cancel_handover',
      title: 'The first order cancels',
      expectation: 'The waiting order gets the ring without sending its size again.',
      passed: await count(RUNS, async () => {
        const o = await cancelHandsOver(db);
        return o.activeReservations === 1 && o.holders[0] === ORDER_B && o.waiting.length === 0;
      }),
    },
    {
      key: 'open_race',
      title: 'Twelve orders hit one ring with no forced order',
      expectation: 'One reservation, eleven orders waiting.',
      passed: await count(RUNS, async () => {
        const o = await openRace(db);
        return o.activeReservations === 1 && o.waiting.length === 11;
      }),
    },
  ].map((s) => ({ ...s, runs: RUNS }));
  const witnessFailed = await count(RUNS, async () => !rightWinner(await forcedOrder(db, new InvertedAllocator())));
  const report = {
    recordedAt: new Date().toISOString(),
    commit: headCommit(),
    postgres: version,
    command: 'docker compose run --rm race',
    scenarios,
    witness: {
      title: 'Same test, with the queue read backwards on purpose',
      runs: RUNS,
      failed: witnessFailed,
    },
  };
  writeFileSync(join(__dirname, '..', 'reports', 'race-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await db.close();
  console.log(`PostgreSQL ${version}, commit ${report.commit.slice(0, 7)}`);
  for (const s of scenarios) console.log(`${s.passed}/${s.runs}  ${s.title}`);
  console.log(`${witnessFailed}/${RUNS}  witness failed, as it must`);
  const allHeld = scenarios.every((s) => s.passed === s.runs) && witnessFailed === RUNS;
  process.exitCode = allHeld ? 0 : 1;
}

main().catch((error) => {
  console.error(`Failed: ${error?.message || error?.code || error}. Is DATABASE_URL set to a reachable PostgreSQL?`);
  process.exit(1);
});
