// The one scan check. NestJS imports this file; the browser page loads the same
// file bundled as site/shared.js. It has no dependencies and touches no database.

export type QaResult = 'pending' | 'passed' | 'failed';

export interface ScanUnit {
  uuid: string;
  qa: QaResult;
  reservedFor: number | null;
}

export interface ScanOrder {
  id: number;
  expectedUuid: string | null;
  validated: boolean;
}

export type ScanOutcome =
  | { outcome: 'ready'; message: string }
  | { outcome: 'already-validated'; message: string }
  | {
      outcome: 'blocked';
      reason: 'malformed' | 'unknown' | 'failed-qa' | 'no-reservation' | 'other-order' | 'not-reserved';
      message: string;
    };

const FULL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Last four characters, for human reading only. Never used to compare. */
export function suffix(uuid: string): string {
  return `…${uuid.slice(-4).toUpperCase()}`;
}

export function orderLabel(id: number): string {
  return `#${String(id).padStart(3, '0')}`;
}

export function checkScan(input: string, order: ScanOrder, units: ScanUnit[]): ScanOutcome {
  const scanned = input.trim().toLowerCase();
  if (!FULL_ID.test(scanned)) {
    return {
      outcome: 'blocked',
      reason: 'malformed',
      message: 'Packing blocked. That is not a full ring ID. Scan the whole label.',
    };
  }
  const unit = units.find((u) => u.uuid === scanned);
  if (!unit) {
    return {
      outcome: 'blocked',
      reason: 'unknown',
      message: `Packing blocked. Ring ${suffix(scanned)} is not in this stock.`,
    };
  }
  // A failed ring never ships, whoever it is reserved for: QA is checked first.
  if (unit.qa === 'failed') {
    return { outcome: 'blocked', reason: 'failed-qa', message: `Packing blocked. Ring ${suffix(scanned)} failed QA.` };
  }
  if (order.expectedUuid === null) {
    return {
      outcome: 'blocked',
      reason: 'no-reservation',
      message: `Packing blocked. Order ${orderLabel(order.id)} has no ring reserved yet.`,
    };
  }
  const expected = suffix(order.expectedUuid);
  if (scanned !== order.expectedUuid) {
    if (unit.reservedFor !== null) {
      return {
        outcome: 'blocked',
        reason: 'other-order',
        message: `Packing blocked. Ring ${suffix(scanned)} belongs to order ${orderLabel(unit.reservedFor)}. Expected ${expected}.`,
      };
    }
    return {
      outcome: 'blocked',
      reason: 'not-reserved',
      message: `Packing blocked. Ring ${suffix(scanned)} is not reserved for this order. Expected ${expected}.`,
    };
  }
  if (order.validated) {
    return {
      outcome: 'already-validated',
      message: `Already validated. Still one parcel for order ${orderLabel(order.id)}.`,
    };
  }
  return { outcome: 'ready', message: 'Ready for carrier handoff' };
}
