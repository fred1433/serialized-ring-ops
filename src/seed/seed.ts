import { Allocator } from '../allocation/allocator';
import { ReservationService } from '../allocation/reservation.service';
import { FakeCarrier, FakePrinter } from '../channels/fake-providers';
import { ManualClock } from '../clock';
import { Db, migrate } from '../db';
import { ManifestService } from '../inventory/manifest.service';
import { PackingService } from '../packing/packing.service';

// Every name, address, date and ID below is made up. "Aldane" is not a real brand.
export const BRAND = 'Aldane';
export const RING_OK = '8e2f41c6-3b7a-4d19-a6e2-5f0c91d47c21';
export const RING_OTHER = 'c17d0b52-92ee-4a08-b3f1-70ae6d2c3a90';
export const RING_FAILED = 'f40a9e37-1c66-4b7d-8d25-19e3bb704d00';
export const PACKER = 'J. Novak (fictional)';
const RECEIVING = 'M. Teller (fictional)';
const QA = 'R. Osei (fictional)';

export const CUSTOMERS: Record<number, { name: string; city: string; street: string }> = {
  99: { name: 'L. Haddad', street: '4 Sample Row', city: 'Exampleton' },
  104: { name: 'A. Reyes', street: '210 Placeholder Ave', city: 'Exampleton' },
  105: { name: 'P. Lindqvist', street: '38 Fixture Lane', city: 'Testbury' },
};

const MANIFEST_A = `uuid,size,lot
${RING_FAILED},8,L-2291
${RING_OTHER},8,L-2291
`;
const MANIFEST_B = `uuid,size,lot
${RING_OK},8,L-2304
`;

export async function seedDemo(db: Db): Promise<void> {
  const clock = new ManualClock(new Date('2026-10-19T08:30:00Z'));
  const allocator = new Allocator();
  const manifests = new ManifestService(db, clock, allocator);
  const reservations = new ReservationService(db, clock, allocator);
  const packing = new PackingService(db, clock, new FakeCarrier(), new FakePrinter());

  await manifests.importCsv(MANIFEST_A, RECEIVING);
  clock.set('2026-10-19T08:40:00Z');
  await manifests.intakeScan(RING_FAILED, RECEIVING);
  clock.set('2026-10-19T08:52:00Z');
  await manifests.intakeScan(RING_OTHER, RECEIVING);
  clock.set('2026-10-19T11:05:00Z');
  await manifests.recordQa(RING_FAILED, 'failed', QA);
  clock.set('2026-10-19T11:17:00Z');
  await manifests.recordQa(RING_OTHER, 'passed', QA);

  clock.set('2026-10-26T09:10:00Z');
  await manifests.importCsv(MANIFEST_B, RECEIVING);
  clock.set('2026-10-26T09:24:00Z');
  await manifests.intakeScan(RING_OK, RECEIVING);
  clock.set('2026-10-26T13:48:00Z');
  await manifests.recordQa(RING_OK, 'passed', QA);

  await db.pool.query(
    `insert into orders (id, channel, channel_ref, customer, paid_at) values
       (99, 'demo', 'fictional-099', $1, '2026-10-24T15:02:00Z'),
       (104, 'demo', 'fictional-104', $2, '2026-10-29T18:31:00Z'),
       (105, 'demo', 'fictional-105', $3, '2026-10-30T10:12:00Z')`,
    [CUSTOMERS[99].name, CUSTOMERS[104].name, CUSTOMERS[105].name],
  );

  clock.set('2026-10-27T12:00:00Z');
  await packing.sizerDelivered(99);
  clock.set('2026-10-28T17:20:00Z');
  await reservations.submitSize(99, 8);

  clock.set('2026-11-02T14:40:00Z');
  await packing.sizerDelivered(104);
  await packing.sizerDelivered(105);
  clock.set('2026-11-03T09:12:00Z');
  await reservations.submitSize(104, 8);
  clock.set('2026-11-03T16:40:00Z');
  await reservations.submitSize(105, 8);

  clock.set('2026-11-04T08:05:00Z');
  await packing.createLabel(104, PACKER);
}

/** Creates the tables and the fictional orders the first time, and leaves existing data alone after that. */
export async function prepareDemoDatabase(db: Db): Promise<boolean> {
  const created = await migrate(db);
  if (created) await seedDemo(db);
  return created;
}
