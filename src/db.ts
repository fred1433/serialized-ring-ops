import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool, PoolClient } from 'pg';

export const DEFAULT_DATABASE_URL = 'postgres://ring:ring@localhost:5432/ring_ops';

export class Db {
  readonly pool: Pool;

  constructor(url: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL) {
    this.pool = new Pool({ connectionString: url, max: 30 });
  }

  async tx<T>(work: (tx: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await work(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async query<R extends object = Record<string, any>>(sql: string, params: unknown[] = []): Promise<R[]> {
    return (await this.pool.query<R>(sql, params)).rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

const SCHEMA = join(__dirname, '..', 'db', 'schema.sql');

export async function migrate(db: Db): Promise<boolean> {
  const [{ present }] = await db.query<{ present: boolean }>(`select to_regclass('public.units') is not null as present`);
  if (present) return false;
  await db.pool.query(readFileSync(SCHEMA, 'utf8'));
  return true;
}

/** Wipes everything. Called by the tests, the race report and the state export on their own databases. */
export async function resetDb(db: Db): Promise<void> {
  await db.pool.query('drop schema public cascade; create schema public;');
  await db.pool.query(readFileSync(SCHEMA, 'utf8'));
}
