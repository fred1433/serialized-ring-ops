import { Db, resetDb } from '../src/db';
import { services, Services, uuidOf } from './support/app';

describe('manifest and intake on PostgreSQL', () => {
  const db = new Db();
  let s: Services;
  const a = uuidOf(1);
  const b = uuidOf(2);
  const count = async () => (await db.query<{ n: number }>('select count(*)::int as n from units'))[0].n;

  beforeEach(async () => {
    await resetDb(db);
    s = services(db);
  });
  afterAll(() => db.close());

  it('rejects a line repeated inside the file and a bad line, and keeps the rest', async () => {
    const csv = `uuid,size,lot\n${a},8,L-1\n${a},8,L-1\nnot-a-uuid,8,L-1\n${b},99,L-1\n${b},8,\n${b},8,L-1\n`;
    const result = await s.manifests.importCsv(csv, 'test');
    expect(result.accepted).toBe(2);
    expect(result.rejected).toEqual([
      { line: 2, reason: 'duplicate-in-file' },
      { line: 3, reason: 'bad-line' },
      { line: 4, reason: 'bad-line' },
      { line: 5, reason: 'bad-line' },
    ]);
    expect(await count()).toBe(2);
  });

  it('replaying the manifest adds no unit', async () => {
    const csv = `uuid,size,lot\r\n${a},8,L-1\r\n${b},8,L-1\r\n`;
    await s.manifests.importCsv(csv, 'test');
    const replay = await s.manifests.importCsv(csv, 'test');
    expect(replay).toEqual({
      accepted: 0,
      rejected: [
        { line: 1, reason: 'already-imported' },
        { line: 2, reason: 'already-imported' },
      ],
    });
    expect(await count()).toBe(2);
  });

  it('short lines are bad lines, not crashes', async () => {
    const result = await s.manifests.importCsv(`uuid,size,lot\n${a}\n\n`, 'test');
    expect(result.rejected).toEqual([{ line: 1, reason: 'bad-line' }]);
  });

  it('a ring cannot skip intake or go through it twice', async () => {
    await s.manifests.importCsv(`uuid,size,lot\n${a},8,L-1\n`, 'test');
    await expect(s.manifests.recordQa(a, 'passed', 'test')).rejects.toThrow(/cannot go from manifested/);
    await s.manifests.intakeScan(a, 'test');
    await expect(s.manifests.intakeScan(a, 'test')).rejects.toThrow(/cannot go from received/);
  });

  it('a ring that failed QA stays out of the queue', async () => {
    await s.manifests.importCsv(`uuid,size,lot\n${a},8,L-1\n`, 'test');
    await s.manifests.intakeScan(a, 'test');
    await s.manifests.recordQa(a, 'failed', 'test');
    await expect(s.manifests.recordQa(a, 'passed', 'test')).rejects.toThrow(/cannot go from qa_failed/);
  });

  it('refuses an unknown ring', async () => {
    await expect(s.manifests.intakeScan(uuidOf(404), 'test')).rejects.toThrow(/No ring/);
  });
});
