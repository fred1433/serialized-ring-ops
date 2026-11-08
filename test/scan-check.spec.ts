import { checkScan, orderLabel, ScanOrder, ScanUnit, suffix } from '../src/shared';

const EXPECTED = '8e2f41c6-3b7a-4d19-a6e2-5f0c91d47c21';
const OTHER = 'c17d0b52-92ee-4a08-b3f1-70ae6d2c3a90';
const FAILED = 'f40a9e37-1c66-4b7d-8d25-19e3bb704d00';
const FREE = '11111111-1111-4111-8111-111111111111';
const SAME_SUFFIX = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa7c21';

const order: ScanOrder = { id: 104, expectedUuid: EXPECTED, validated: false };
const units: ScanUnit[] = [
  { uuid: EXPECTED, qa: 'passed', reservedFor: 104 },
  { uuid: OTHER, qa: 'passed', reservedFor: 99 },
  { uuid: FAILED, qa: 'failed', reservedFor: null },
  { uuid: FREE, qa: 'passed', reservedFor: null },
  { uuid: SAME_SUFFIX, qa: 'passed', reservedFor: 200 },
];

describe('scan check shared by the API and the page', () => {
  it('prints the exact refusal for a ring reserved to another order', () => {
    expect(checkScan(OTHER, order, units).message).toBe('Packing blocked. Ring …3A90 belongs to order #099. Expected …7C21.');
  });

  it('prints the exact refusal for a ring that failed QA', () => {
    expect(checkScan(FAILED, order, units).message).toBe('Packing blocked. Ring …4D00 failed QA.');
  });

  it('checks QA before the reservation', () => {
    const failedAndReserved = [{ uuid: FAILED, qa: 'failed' as const, reservedFor: 99 }];
    expect(checkScan(FAILED, order, failedAndReserved)).toMatchObject({ outcome: 'blocked', reason: 'failed-qa' });
  });

  it('accepts the expected ring, then reports the repeat without a second parcel', () => {
    expect(checkScan(EXPECTED, order, units)).toEqual({ outcome: 'ready', message: 'Ready for carrier handoff' });
    expect(checkScan(EXPECTED, { ...order, validated: true }, units).outcome).toBe('already-validated');
  });

  it('compares the whole ID: the same last four characters do not pass', () => {
    expect(suffix(SAME_SUFFIX)).toBe(suffix(EXPECTED));
    expect(checkScan(SAME_SUFFIX, order, units)).toMatchObject({ outcome: 'blocked', reason: 'other-order' });
  });

  it('refuses a suffix typed alone, and an unknown ring', () => {
    expect(checkScan('7C21', order, units)).toMatchObject({ outcome: 'blocked', reason: 'malformed' });
    expect(checkScan('22222222-2222-4222-8222-222222222222', order, units)).toMatchObject({ outcome: 'blocked', reason: 'unknown' });
  });

  it('refuses a free ring that is not this order\'s', () => {
    expect(checkScan(FREE, order, units)).toMatchObject({ outcome: 'blocked', reason: 'not-reserved' });
  });

  it('refuses any ring for an order with no reservation', () => {
    expect(checkScan(FREE, { id: 105, expectedUuid: null, validated: false }, units)).toMatchObject({
      outcome: 'blocked',
      reason: 'no-reservation',
      message: 'Packing blocked. Order #105 has no ring reserved yet.',
    });
  });

  it('reads scanner input the way a keyboard wedge sends it', () => {
    expect(checkScan(`  ${EXPECTED.toUpperCase()}\n`, order, units).outcome).toBe('ready');
  });

  it('pads order numbers for reading', () => {
    expect(orderLabel(99)).toBe('#099');
    expect(orderLabel(1000)).toBe('#1000');
  });
});
