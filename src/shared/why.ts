// Builds the "Why this ring?" answer from data only. The same function feeds the
// API and the page, so nothing on the panel is written by hand. It states the dated
// reservation, then stock and queue as they are now. It says nothing about how much
// stock existed at the moment of attribution, because that is not recorded.
import { orderLabel, suffix } from './scan-check';

export interface HistoryEntry {
  at: string;
  kind: string;
  actor: string;
  detail: string;
  /** The ID the scanner sent, on scan lines. */
  scanned: string | null;
}

export interface WhyInput {
  orderId: number;
  size: number;
  uuid: string;
  submittedAt: string;
  reservedAt: string;
  history: HistoryEntry[];
  /** Eligible rings of this size free right now. */
  freeNow: number;
  /** Orders of this size waiting right now, oldest request first. */
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

/** Same, with the year, for a result that stays on record. */
export function formatDated(iso: string): string {
  const d = new Date(iso);
  return formatAt(iso).replace(', ', `, ${d.getUTCFullYear()}, `);
}

function stockNow(free: number, size: number): string {
  if (free === 0) return `No size ${size} ring is free now.`;
  return free === 1 ? `1 size ${size} ring is free now.` : `${free} size ${size} rings are free now.`;
}

export function explainWhy(input: WhyInput): WhyAnswer {
  const ring = suffix(input.uuid);
  const held = `Order ${orderLabel(input.orderId)} sent its size on ${formatAt(input.submittedAt)} and has held ${ring} since ${formatAt(input.reservedAt)}.`;
  const next = input.waiting[0];
  const queue = next
    ? `Order ${orderLabel(next.orderId)} sent its size later, on ${formatAt(next.submittedAt)}, and waits for the next ring.`
    : 'No order is waiting.';
  return {
    title: `Why ring ${ring} for order ${orderLabel(input.orderId)}`,
    line: `${held} ${stockNow(input.freeNow, input.size)} ${queue}`,
    history: input.history,
  };
}
