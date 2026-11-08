// Runs the real services over the seed on a real database and writes what the page shows.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Db, resetDb } from '../src/db';
import { readDemoState } from '../src/seed/demo-state';
import { seedDemo } from '../src/seed/seed';

async function main(): Promise<void> {
  const db = new Db();
  await resetDb(db);
  await seedDemo(db);
  const state = await readDemoState(db);
  writeFileSync(join(__dirname, '..', 'page', 'demo-state.json'), `${JSON.stringify(state, null, 2)}\n`);
  await db.close();
  console.log('Wrote page/demo-state.json');
}

main().catch((error) => {
  console.error(`Failed: ${error?.message || error?.code || error}. Is DATABASE_URL set to a reachable PostgreSQL?`);
  process.exit(1);
});
