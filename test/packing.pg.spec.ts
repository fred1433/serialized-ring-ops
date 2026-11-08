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
    expect(await s.packing.pairingEligibility(RING_OK)).toEqual({ eligible: false, status: 'reserved' });
    await s.packing.scan(ORDER, RING_OK, PACKER);
    await s.packing.handOff(ORDER, PACKER);
    await s.packing.sizerDelivered(ORDER);
    expect((await s.packing.slip(ORDER)).deliveredAt).toBeNull();
    expect((await s.packing.pairingEligibility(RING_OK)).eligible).toBe(false);
  });

  it('eligibility answers yes only after the ring itself is delivered', async () => {
    await s.packing.scan(ORDER, RING_OK, PACKER);
    await s.packing.handOff(ORDER, PACKER);
    await s.packing.ringDelivered(ORDER);
    expect(await s.packing.pairingEligibility(RING_OK)).toEqual({ eligible: true, status: 'delivered' });
    await expect(s.packing.pairingEligibility(uuidOf(404))).rejects.toThrow(/No ring/);
  });

  it('why this ring: only from the database', async () => {
    const answer = await s.packing.why(ORDER);
    expect(answer.line).toBe(
      'Order #104 sent its size on Nov 3, 09:12 UTC and has held …7C21 since Nov 3, 09:12 UTC. No size 8 ring is free now. Order #105 sent its size later, on Nov 3, 16:40 UTC, and waits for the next ring.',
    );
    expect(answer.history.map((h) => h.kind)).toEqual(['manifest', 'intake', 'qa', 'sizer_delivered', 'size', 'reserved', 'label']);
    await expect(s.packing.why(105)).rejects.toThrow(/no ring reserved/);
  });

  it('why this ring tells no past it did not record: order #099 was not given the last ring', async () => {
    const { line } = await s.packing.why(99);
    expect(line).not.toMatch(/last/);
    expect(line).toContain('has held …3A90 since Oct 28, 17:20 UTC. No size 8 ring is free now.');
  });

  it('a refused scan shows under the order with the ID scanned, and stays out of that other ring\'s history', async () => {
    const before = await s.packing.history(RING_OTHER);
    await s.packing.scan(ORDER, RING_OTHER, PACKER);
    await s.packing.scan(ORDER, 'not-a-ring', PACKER);
    const refused = (await s.packing.why(ORDER)).history.filter((h) => h.kind === 'scan_refused');
    expect(refused.map((h) => h.scanned)).toEqual([RING_OTHER, 'not-a-ring']);
    expect(refused[0].actor).toBe(PACKER);
    expect(await s.packing.history(RING_OTHER)).toEqual(before);
  });

  it('a repeated scan shows under the order too', async () => {
    await s.packing.scan(ORDER, RING_OK, PACKER);
    await s.packing.scan(ORDER, RING_OK, PACKER);
    const kinds = (await s.packing.why(ORDER)).history.map((h) => h.kind);
    expect(kinds).toEqual(expect.arrayContaining(['scan_accepted', 'scan_repeated']));
  });

  it('a label is not printed twice, and keeps its date', async () => {
    const ring = uuidOf(7);
    await db.pool.query(`delete from size_requests where order_id = 105`);
    await addRing(s, ring, '2026-11-05T08:00:00Z');
    await addOrder(db, 700);
    await s.reservations.submitSize(700, 8);
    s.clock.set('2026-11-08T10:00:00Z');
    const first = await s.packing.createLabel(700, PACKER);
    const date = (await s.packing.slip(700)).labelCreatedAt;
    s.clock.set('2026-11-08T11:00:00Z');
    expect(await s.packing.createLabel(700, PACKER)).toBe(first);
    expect(s.printer.printed).toEqual([first]);
    expect((await s.packing.slip(700)).labelCreatedAt).toEqual(date);
    const [{ n }] = await db.query<{ n: number }>(`select count(*)::int as n from packing_events where order_id = 700 and kind = 'label'`);
    expect(n).toBe(1);
  });

  it('a cancelled order gets no label and no scan', async () => {
    await s.reservations.cancel(99);
    await expect(s.packing.createLabel(99, PACKER)).rejects.toThrow(/cancelled/);
    await expect(s.packing.scan(99, RING_OTHER, PACKER)).rejects.toThrow(/cancelled/);
    expect(s.printer.printed).toEqual([]);
  });

  it('a label can come before the size, with no ring attached yet', async () => {
    await addOrder(db, 701);
    await expect(s.packing.createLabel(701, PACKER)).resolves.toContain('701');
    await expect(s.packing.createLabel(9999, PACKER)).rejects.toThrow(/No such order/);
  });

  it('refuses unknown orders everywhere', async () => {
    await expect(s.packing.slip(9999)).rejects.toThrow(/No such order/);
    expect(await s.packing.history(RING_OK.toUpperCase())).toEqual(await s.packing.history(RING_OK));
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
