// Builds the "Why this ring?" answer from data only. The same function feeds the
// API and the page, so nothing on the panel is written by hand.
import { orderLabel, suffix } from './scan-check';

export interface HistoryEntry {
  at: string;
  kind: string;
  actor: string;
  detail: string;
}

export interface WhyInput {
  orderId: number;
  size: number;
  uuid: string;
  submittedAt: string;
  history: HistoryEntry[];
  /** Eligible rings of this size still free after this reservation. */
  eligibleLeft: number;
  /** Orders of this size still waiting, oldest request first. */
  waiting: { orderId: number; submittedAt: string }[];
}

export interface WhyAnswer {
  title: string;
  line: string;
  history: HistoryEntry[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Fixed format, always UTC, so the page and the API print the same thing. */
export function formatAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function explainWhy(input: WhyInput): WhyAnswer {
  const who = `Order ${orderLabel(input.orderId)}`;
  const ring = suffix(input.uuid);
  const which = input.eligibleLeft === 0 ? `the last size ${input.size} ring ready to ship` : `a size ${input.size} ring ready to ship`;
  const next = input.waiting[0];
  const line = next
    ? `${who} got ${ring}, ${which}, because its size came in on ${formatAt(input.submittedAt)}, before order ${orderLabel(next.orderId)} on ${formatAt(next.submittedAt)}. Order ${orderLabel(next.orderId)} waits for the next ring.`
    : `${who} got ${ring}, ${which}, because its size came in on ${formatAt(input.submittedAt)} and no earlier request was waiting.`;
  return { title: `Why ring ${ring} for order ${orderLabel(input.orderId)}`, line, history: input.history };
}
