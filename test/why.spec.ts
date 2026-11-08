import { explainWhy, formatAt } from '../src/shared';

const base = {
  orderId: 104,
  size: 8,
  uuid: '8e2f41c6-3b7a-4d19-a6e2-5f0c91d47c21',
  submittedAt: '2026-11-03T09:12:00.000Z',
  history: [],
};

describe('why this ring', () => {
  it('builds the sentence from the data', () => {
    const answer = explainWhy({
      ...base,
      eligibleLeft: 0,
      waiting: [{ orderId: 105, submittedAt: '2026-11-03T16:40:00.000Z' }],
    });
    expect(answer.line).toBe(
      'Order #104 got …7C21, the last size 8 ring ready to ship, because its size came in on Nov 3, 09:12 UTC, before order #105 on Nov 3, 16:40 UTC. Order #105 waits for the next ring.',
    );
  });

  it('does not say "last" when rings remain, and names nobody when nobody waits', () => {
    const answer = explainWhy({ ...base, eligibleLeft: 2, waiting: [] });
    expect(answer.line).toBe('Order #104 got …7C21, a size 8 ring ready to ship, because its size came in on Nov 3, 09:12 UTC and no earlier request was waiting.');
  });

  it('formats in UTC', () => {
    expect(formatAt('2026-01-05T00:03:00Z')).toBe('Jan 5, 00:03 UTC');
  });
});
