import 'reflect-metadata';
import { Allocator } from '../../src/allocation/allocator';
import { ReservationService } from '../../src/allocation/reservation.service';
import { FakeCarrier, FakePrinter } from '../../src/channels/fake-providers';
import { ManualClock } from '../../src/clock';
import { Db } from '../../src/db';
import { ManifestService } from '../../src/inventory/manifest.service';
import { PackingService } from '../../src/packing/packing.service';

export function services(db: Db, allocator: Allocator = new Allocator()) {
  const clock = new ManualClock(new Date('2026-11-01T00:00:00Z'));
  const printer = new FakePrinter();
  return {
    clock,
    allocator,
    printer,
    manifests: new ManifestService(db, clock, allocator),
    reservations: new ReservationService(db, clock, allocator),
    packing: new PackingService(db, clock, new FakeCarrier(), printer),
  };
}

export type Services = ReturnType<typeof services>;

export const uuidOf = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export async function addOrder(db: Db, id: number): Promise<void> {
  await db.pool.query(
    `insert into orders (id, channel, channel_ref, customer, paid_at) values ($1, 'test', $2, 'Test customer', '2026-11-01T00:00:00Z')`,
    [id, `ref-${id}`],
  );
}

/** Puts one ring through manifest, intake and QA at a chosen intake date. */
export async function addRing(s: Services, uuid: string, intakeAt: string, qa: 'passed' | 'failed' = 'passed', size = 8): Promise<void> {
  s.clock.set(intakeAt);
  await s.manifests.importCsv(`uuid,size,lot\n${uuid},${size},L-TEST\n`, 'test');
  await s.manifests.intakeScan(uuid, 'test');
  await s.manifests.recordQa(uuid, qa, 'test');
}
