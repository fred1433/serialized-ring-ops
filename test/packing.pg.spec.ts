import { Db, resetDb } from '../src/db';
import { BRAND, PACKER, prepareDemoDatabase, RING_FAILED, RING_OK, RING_OTHER, seedDemo } from '../src/seed/seed';
import { readDemoState } from '../src/seed/demo-state';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addOrder, addRing, services, Services, uuidOf } from './support/app';

const ORDER = 104;

describe('packing on PostgreSQL', () => {
  const db = new Db();
  let s: Services;

  beforeEach(async () => {
    await resetDb(db);
    await seedDemo(db);
    s = services(db);
    s.clock.set('2026-11-08T10:00:00Z');
  });
  afterAll(() => db.close());

  const reservationsNow = () =>
    db.query<{ order_id: number; unit_uuid: string }>('select order_id, unit_uuid from reservations where active order by order_id');
  const refusals = () =>
    db.query<{ actor: string; at: Date; reason: string; detail: string }>(`select actor, at, reason, detail from packing_events where kind = 'scan_refused'`);

  it('wrong ring: exact text, both reservations intact, refusal in the history with actor, time and reason', async () => {
    const before = await reservationsNow();
    const decision = await s.packing.scan(ORDER, RING_OTHER, PACKER);
    expect(decision.message).toBe('Packing blocked. Ring …3A90 belongs to order #099. Expected …7C21.');
    expect(await reservationsNow()).toEqual(before);
    expect(before).toEqual([
      { order_id: 99, unit_uuid: RING_OTHER },
      { order_id: 104, unit_uuid: RING_OK },
    ]);
    const [refusal] = await refusals();
    expect(refusal).toMatchObject({ actor: PACKER, reason: 'other-order', detail: decision.message });
    expect(refusal.at.toISOString()).toBe('2026-11-08T10:00:00.000Z');
    expect((await s.packing.slip(ORDER)).validatedAt).toBeNull();
  });

  it('failed ring: exact text, no reservation moves, refusal logged', async () => {
    const before = await reservationsNow();
    const decision = await s.packing.scan(ORDER, RING_FAILED, PACKER);
    expect(decision.message).toBe('Packing blocked. Ring …4D00 failed QA.');
    expect(await reservationsNow()).toEqual(before);
    expect((await refusals())[0]).toMatchObject({ actor: PACKER, reason: 'failed-qa' });
  });

  it('right ring twice: ready once, one parcel, and the repeat is logged as a repeat', async () => {
    expect((await s.packing.scan(ORDER, RING_OK, PACKER)).message).toBe('Ready for carrier handoff');
    expect((await s.packing.scan(ORDER, RING_OK, PACKER)).outcome).toBe('already-validated');
    const parcels = await db.query('select * from parcels where order_id = $1 and validated_at is not null', [ORDER]);
    expect(parcels).toHaveLength(1);
    const [{ accepted }] = await db.query<{ accepted: number }>(`select count(*)::int as accepted from packing_events where kind = 'scan_accepted'`);
    expect(accepted).toBe(1);
    const [{ repeats }] = await db.query<{ repeats: number }>(`select count(*)::int as repeats from packing_events where kind = 'scan_repeated'`);
    expect(repeats).toBe(1);
  });

  it('two scans of the right ring at the same moment still give one parcel', async () => {
    const outcomes = await Promise.all([s.packing.scan(ORDER, RING_OK, PACKER), s.packing.scan(ORDER, RING_OK, PACKER)]);
    expect(outcomes.map((o) => o.outcome).sort()).toEqual(['already-validated', 'ready']);
  });

  it('the label exists before the wrong scan, and the wrong scan leaves it alone', async () => {
    const before = await s.packing.slip(ORDER);
    expect(before.labelCreatedAt).not.toBeNull();
    await s.packing.scan(ORDER, RING_OTHER, PACKER);
    const after = await s.packing.slip(ORDER);
    expect(after.labelCreatedAt).toEqual(before.labelCreatedAt);
    expect(after.validatedAt).toBeNull();
    await expect(s.packing.handOff(ORDER, PACKER)).rejects.toThrow(/not validated/);
  });

  it('label, handoff and delivery are three separate states, in order', async () => {
    await expect(s.packing.ringDelivered(ORDER)).rejects.toThrow(/not handed/);
    await s.packing.scan(ORDER, RING_OK, PACKER);
    await expect(s.packing.ringDelivered(ORDER)).rejects.toThrow(/not handed/);
    let slip = await s.packing.slip(ORDER);
    expect(slip.handedOffAt).toBeNull();
    await s.packing.handOff(ORDER, PACKER);
    slip = await s.packing.slip(ORDER);
    expect(slip.handedOffAt).not.toBeNull();
    expect(slip.deliveredAt).toBeNull();
    await s.packing.ringDelivered(ORDER);
    expect((await s.packing.slip(ORDER)).deliveredAt).not.toBeNull();
  });

  it('a validated parcel without a label cannot be handed off', async () => {
    const ring = uuidOf(7);
    await db.pool.query(`delete from size_requests where order_id = 105`);
    await addRing(s, ring, '2026-11-05T08:00:00Z');
    await addOrder(db, 700);
    await s.reservations.submitSize(700, 8);
    await s.packing.scan(700, ring, PACKER);
    await expect(s.packing.handOff(700, PACKER)).rejects.toThrow(/no label/);
    await s.packing.createLabel(700, PACKER);
    await expect(s.packing.handOff(700, PACKER)).resolves.toBeUndefined();
    expect(s.printer.printed).toEqual(['fake://labels/700.pdf']);
  });

  it('a sizer delivered never marks the ring delivered', async () => {
    await s.packing.sizerDelivered(ORDER);
    const slip = await s.packing.slip(ORDER);
    expect(slip.sizerDeliveredAt).not.toBeNull();
    expect(slip.deliveredAt).toBeNull();
    expect(await s.packing.pairCheck(RING_OK)).toEqual({ eligible: false, status: 'reserved' });
    await s.packing.scan(ORDER, RING_OK, PACKER);
    await s.packing.handOff(ORDER, PACKER);
    await s.packing.sizerDelivered(ORDER);
    expect((await s.packing.slip(ORDER)).deliveredAt).toBeNull();
    expect((await s.packing.pairCheck(RING_OK)).eligible).toBe(false);
  });

  it('pair-check answers eligible only after the ring itself is delivered', async () => {
    await s.packing.scan(ORDER, RING_OK, PACKER);
    await s.packing.handOff(ORDER, PACKER);
    await s.packing.ringDelivered(ORDER);
    expect(await s.packing.pairCheck(RING_OK)).toEqual({ eligible: true, status: 'delivered' });
    await expect(s.packing.pairCheck(uuidOf(404))).rejects.toThrow(/No ring/);
  });

  it('why this ring: only from the database', async () => {
    const answer = await s.packing.why(ORDER);
    expect(answer.line).toContain('Order #104 got …7C21, the last size 8 ring ready to ship');
    expect(answer.line).toContain('Order #105 waits');
    expect(answer.history.map((h) => h.kind)).toEqual(['manifest', 'intake', 'qa', 'size', 'reserved']);
    await expect(s.packing.why(105)).rejects.toThrow(/no ring reserved/);
  });

  it('refuses unknown orders everywhere', async () => {
    await expect(s.packing.slip(9999)).rejects.toThrow(/No such order/);
    await expect(s.packing.scan(9999, RING_OK, PACKER)).rejects.toThrow(/No such order/);
    await expect(s.packing.sizerDelivered(9999)).rejects.toThrow(/No such order/);
  });

  it('the page data file is exactly what the services produce', async () => {
    const state = await readDemoState(db);
    expect(state.brand).toBe(BRAND);
    expect(state.rings.map((r) => r.uuid)).toEqual([RING_OTHER, RING_FAILED, RING_OK]);
    const committed = JSON.parse(readFileSync(join(__dirname, '..', 'page', 'demo-state.json'), 'utf8'));
    expect(JSON.parse(JSON.stringify(state))).toEqual(committed);
  });

  it('prepareDemoDatabase seeds an empty database once', async () => {
    await db.pool.query('drop schema public cascade; create schema public;');
    await expect(prepareDemoDatabase(db)).resolves.toBe(true);
    await expect(prepareDemoDatabase(db)).resolves.toBe(false);
    const [{ n }] = await db.query<{ n: number }>('select count(*)::int as n from orders');
    expect(n).toBe(3);
  });
});
