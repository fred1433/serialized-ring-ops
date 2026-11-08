import { explainWhy, formatAt, formatDated } from '../src/shared';

const base = {
  orderId: 104,
  size: 8,
  uuid: '8e2f41c6-3b7a-4d19-a6e2-5f0c91d47c21',
  submittedAt: '2026-11-03T09:12:00.000Z',
  reservedAt: '2026-11-03T09:12:30.000Z',
  history: [],
};

describe('why this ring', () => {
  it('builds the sentence from the data', () => {
    const answer = explainWhy({
      ...base,
      freeNow: 0,
      waiting: [{ orderId: 105, submittedAt: '2026-11-03T16:40:00.000Z' }],
    });
    expect(answer.line).toBe(
      'Order #104 sent its size on Nov 3, 09:12 UTC and has held …7C21 since Nov 3, 09:12 UTC. No size 8 ring is free now. Order #105 sent its size later, on Nov 3, 16:40 UTC, and waits for the next ring.',
    );
  });

  it('gives stock and queue in the present, and never says "last"', () => {
    const two = explainWhy({ ...base, freeNow: 2, waiting: [] }).line;
    expect(two).toContain('2 size 8 rings are free now. No order is waiting.');
    expect(explainWhy({ ...base, freeNow: 1, waiting: [] }).line).toContain('1 size 8 ring is free now.');
    expect(two).not.toMatch(/last/);
  });

  it('formats in UTC', () => {
    expect(formatAt('2026-01-05T00:03:00Z')).toBe('Jan 5, 00:03 UTC');
    expect(formatDated('2026-11-08T13:54:00Z')).toBe('Nov 8, 2026, 13:54 UTC');
  });
});
