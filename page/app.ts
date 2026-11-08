import { checkScan, formatAt, formatDated, HistoryEntry, orderLabel, ScanOutcome, ScanUnit, suffix, WhyAnswer } from '../src/shared';
import { barcodeSvg } from './code128';

interface Ring extends ScanUnit {
  lot: string;
  size: number;
}
interface State {
  brand: string;
  packer: string;
  slip: {
    orderId: number;
    size: number;
    sizeSubmittedAt: string;
    expectedUuid: string;
    lot: string;
    labelCreatedAt: string;
    sizerDeliveredAt: string;
  };
  shipTo: { name: string; street: string; city: string };
  rings: Ring[];
  why: WhyAnswer;
  reservations: { orderId: number; uuid: string }[];
  waiting: { orderId: number; submittedAt: string }[];
}
interface RaceReport {
  recordedAt: string;
  commit: string;
  postgres: string;
  command: string;
  scenarios: { key: string; title: string; runs: number; passed: number }[];
  witness: { title: string; runs: number; failed: number };
}
interface CoverageTotal {
  statements: { pct: number };
  branches: { pct: number };
  functions: { pct: number };
  lines: { pct: number };
}

declare const __DEMO_STATE__: State;
declare const __RACE_REPORT__: RaceReport | null;
declare const __COVERAGE__: CoverageTotal | null;

const REPO = 'https://github.com/fred1433/serialized-ring-ops';
const state = __DEMO_STATE__;
const report = __RACE_REPORT__;
const coverage = __COVERAGE__;
const { slip } = state;
const order = orderLabel(slip.orderId);
const expected = suffix(slip.expectedUuid);
const motionOk = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(pointer: coarse)').matches;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
/** Keeps a suffix like …7C21 on one line. The text itself is unchanged. */
const setVerdict = (el: HTMLElement, text: string) => {
  el.innerHTML = esc(text).replace(/…[0-9A-F]{4}/g, '<span class="id">$&</span>');
};

let validatedAt: string | null = null;
let parcels = 0;
let refusals = 0;
let scans: HistoryEntry[] = [];
let scanning = false;

/* The slip */
$('slip-title').textContent = `Packing slip ${order} · Size ${slip.size}`;
$('ship-to').innerHTML = [state.shipTo.name, state.shipTo.street, state.shipTo.city].map(esc).join('<br>');
$('brand').textContent = `${state.brand} is a made-up brand.`;
$('packer').textContent = `Packer: ${state.packer}`;
$('expected-suffix').textContent = expected;
$('expected-uuid').textContent = slip.expectedUuid;
$('expected-meta').textContent = `Lot ${slip.lot}, size ${slip.size} submitted ${formatAt(slip.sizeSubmittedAt)}`;
$('sizer-line').textContent = `The sizer went in its own parcel, delivered ${formatAt(slip.sizerDeliveredAt)}. That delivery never counts as the ring being delivered.`;

function renderParcel(): void {
  const rows: [string, string | null][] = [
    ['Carrier label created', formatAt(slip.labelCreatedAt)],
    ['Packing validated', validatedAt && formatAt(validatedAt)],
    ['Handed to carrier', null],
    ['Ring delivered', null],
    ['Eligible to pair', null],
  ];
  $('parcel-states').innerHTML = rows
    .map(([label, at]) => `<li class="${at ? 'done' : ''}"><span class="box" aria-hidden="true"></span><span>${label}${at ? `<small>${at}</small>` : ''}<span class="sr">${at ? ': done' : ': not yet'}</span></span></li>`)
    .join('');
}
renderParcel();

/* The rings on the bench: three labels that read the same at a glance. */
$('prompt').textContent = `Three size ${slip.size} rings on the bench. One belongs to this slip. Try one that does not.`;
$('stickers').innerHTML = state.rings
  .map(
    (ring, i) => `<button type="button" class="sticker s${i}" data-uuid="${ring.uuid}" aria-label="Scan ring ${suffix(ring.uuid)}">
      <span class="sticker-top"><span>${esc(state.brand)} ring</span><b>Size ${ring.size}</b></span>
      <span class="code">${barcodeSvg(ring.uuid)}<span class="laser"></span></span>
      <span class="sticker-id"><b>${suffix(ring.uuid)}</b><span>Lot ${esc(ring.lot)}</span></span>
      <span class="sticker-uuid">${ring.uuid}</span>
      <span class="sticker-action">Scan this ring</span>
    </button>`,
  )
  .join('');

/* Scanning */
const units: ScanUnit[] = state.rings.map(({ uuid, qa, reservedFor }) => ({ uuid, qa, reservedFor }));
const input = $<HTMLInputElement>('scan-input');
const stamp = $('stamp');

function focusScanner(): void {
  if (!touch) input.focus({ preventScroll: true });
}

function thud(text: string, kind: 'refused' | 'passed'): void {
  stamp.className = `stamp ${kind}`;
  stamp.textContent = text;
  // Restart the keyframes on a repeat scan.
  void stamp.offsetWidth;
  stamp.classList.add('on');
}

function nextHint(): string {
  const wrong = state.rings.find((r) => r.uuid !== slip.expectedUuid);
  return refusals === 0 && wrong ? `To see a refusal, start over and scan ${suffix(wrong.uuid)} first.` : '';
}

function logScan(kind: string, detail: string, scanned: string): void {
  scans.push({ at: new Date().toISOString(), kind, actor: state.packer, detail, scanned });
  renderHistory();
}

/* What the note may claim depends on what was refused: not every refusal involves two reservations. */
function refusalNote(reason: string): string {
  const logged = 'The refusal went into the packing history.';
  if (reason === 'other-order') return `Both reservations are unchanged. The label stays printed; the parcel cannot leave. ${logged}`;
  if (reason === 'failed-qa') return `This ring has no reservation to change, and it stays out of every parcel. The parcel still needs ${expected}. ${logged}`;
  return `No reservation changed. The parcel still needs ${expected}. ${logged}`;
}

function clearVerdict(): void {
  delete $('result').dataset.outcome;
  stamp.className = 'stamp';
  stamp.textContent = '';
  $('result-note').textContent = '';
}

function showResult(decision: ScanOutcome, scanned: string): void {
  const box = $('result');
  box.dataset.outcome = decision.outcome;
  setVerdict($('result-text'), decision.message);
  if (decision.outcome === 'blocked') {
    thud('Blocked', 'refused');
    refusals += 1;
    logScan('scan_refused', decision.message, scanned);
    $('result-note').textContent = refusalNote(decision.reason);
  } else if (decision.outcome === 'rejected') {
    thud('Rejected', 'refused');
    refusals += 1;
    logScan('scan_refused', decision.message, scanned);
    $('result-note').textContent = `This ring stays off the parcel. The parcel validated with ${expected} is unchanged. The refusal went into the packing history.`;
  } else if (decision.outcome === 'ready' || decision.outcome === 'validated-no-label') {
    thud('Ready', 'passed');
    validatedAt = new Date().toISOString();
    parcels = 1;
    renderParcel();
    logScan('scan_accepted', decision.message, scanned);
    $('result-note').textContent = `Parcels validated for this order: ${parcels}. ${nextHint()}`.trim();
  } else {
    thud('Ready', 'passed');
    logScan('scan_repeated', decision.message, scanned);
    $('result-note').textContent = `Parcels validated for this order: ${parcels}. A second scan adds nothing.`;
  }
  $('why-button').hidden = refusals === 0;
  $('reset-button').hidden = false;
  // On phones the rings stay docked at the bottom, so the verdict has to clear them.
  const tray = $('rings');
  const floor = getComputedStyle(tray).position === 'sticky' ? tray.getBoundingClientRect().top : innerHeight;
  if (box.getBoundingClientRect().bottom > floor || box.getBoundingClientRect().top < 0) {
    const rect = box.getBoundingClientRect();
    const top = scrollY + rect.top - Math.max(8, (floor - rect.height) / 2);
    scrollTo({ top, behavior: motionOk ? 'smooth' : 'auto' });
  }
}

function runScan(value: string): void {
  const decision = checkScan(value, { id: slip.orderId, expectedUuid: slip.expectedUuid, validated: validatedAt !== null, labelled: slip.labelCreatedAt !== null }, units);
  showResult(decision, value.trim());
  input.value = '';
  focusScanner();
}

$('scan-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (scanning) return;
  if (input.value.trim() === '') {
    clearVerdict();
    $('result-text').textContent = 'Scan a label, or type a full ring ID and press Enter.';
    focusScanner();
    return;
  }
  runScan(input.value);
});

/* Clicking a label sends its ID the way a keyboard-wedge scanner would. */
$('stickers').addEventListener('click', (event) => {
  const sticker = (event.target as HTMLElement).closest<HTMLButtonElement>('.sticker');
  if (!sticker || scanning) return;
  const uuid = sticker.dataset.uuid as string;
  if (!motionOk) {
    runScan(uuid);
    return;
  }
  scanning = true;
  sticker.classList.add('scanning');
  let shown = 0;
  const timer = setInterval(() => {
    shown += 4;
    input.value = uuid.slice(0, shown);
    if (shown >= uuid.length) {
      clearInterval(timer);
      sticker.classList.remove('scanning');
      scanning = false;
      runScan(uuid);
    }
  }, 22);
});

/* Why this ring? */
function renderHistory(): void {
  const tone: Record<string, string> = { scan_refused: 'refusal', scan_accepted: 'accepted', scan_repeated: 'accepted' };
  const row = (h: HistoryEntry) =>
    `<li class="${tone[h.kind] ?? ''}"><time>${formatAt(h.at)}</time><span>${esc(h.detail)}${h.kind === 'scan_refused' && h.scanned ? `<small>Scanned: ${esc(h.scanned)}</small>` : ''}</span><span class="who">${esc(h.actor[0].toUpperCase() + h.actor.slice(1))}</span></li>`;
  $('history').innerHTML = [...state.why.history, ...scans].map(row).join('');
}

$('why-title').textContent = state.why.title;
setVerdict($('why-line'), state.why.line);
$('held').textContent = `Held now: ${state.reservations.map((r) => `order ${orderLabel(r.orderId)} has ${suffix(r.uuid)}`).join(', ')}. Waiting: ${state.waiting.map((w) => `order ${orderLabel(w.orderId)}`).join(', ')}.`;
renderHistory();

const canary = $('canary');
const whyButton = $('why-button');
whyButton.addEventListener('click', () => {
  const open = canary.hidden;
  canary.hidden = !open;
  whyButton.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('why-open', open);
  if (open && motionOk) {
    canary.classList.remove('slide');
    void canary.offsetWidth;
    canary.classList.add('slide');
  }
  focusScanner();
});

$('reset-button').addEventListener('click', () => {
  validatedAt = null;
  parcels = 0;
  refusals = 0;
  scans = [];
  renderParcel();
  renderHistory();
  clearVerdict();
  canary.hidden = true;
  document.body.classList.remove('why-open');
  whyButton.setAttribute('aria-expanded', 'false');
  whyButton.hidden = true;
  $('reset-button').hidden = true;
  $('result-text').textContent = 'Nothing scanned yet.';
  focusScanner();
});

/* The recorded result. Every number comes from reports/race-report.json. */
const roll = $('roll');
if (report) {
  const short = report.commit.slice(0, 7);
  const forced = report.scenarios.find((s) => s.key === 'forced_order');
  if (forced && forced.passed === forced.runs) {
    $('proof-claim').textContent = `The earlier order got the last ring in all ${forced.runs} runs, even when the later order's connection moved first.`;
  }
  $('witness-line').textContent = `To check that the test can fail at all, the same run reads the queue backwards on purpose. It failed ${report.witness.failed} of ${report.witness.runs} times, as it should.`;
  const rows = report.scenarios
    .map((s) => `<li><span>${esc(s.title)}</span><b>${s.passed}/${s.runs}</b></li>`)
    .join('');
  roll.innerHTML = `<h3>Recorded test run</h3>
    <p class="roll-meta">${formatDated(report.recordedAt)}<br>Commit <a href="${REPO}/commit/${esc(report.commit)}">${esc(short)}</a><br>PostgreSQL ${esc(report.postgres)}</p>
    <ul>${rows}</ul>
    <p class="roll-witness"><span>${esc(report.witness.title)}</span><b>failed ${report.witness.failed}/${report.witness.runs}</b></p>
    <p class="roll-cmd">Replay it<code>${esc(report.command)}</code></p>`;
} else {
  roll.innerHTML = '<h3>Recorded test run</h3><p class="roll-meta">No recorded run in this build. Run the race report, then rebuild the page.</p>';
}

/* The line for a technical reader. */
const covered = coverage
  ? `Test coverage ${Math.min(coverage.statements.pct, coverage.branches.pct, coverage.functions.pct, coverage.lines.pct)}% on its lowest measure.`
  : 'Test coverage not recorded in this build.';
$('tech-line').innerHTML = `<a href="${REPO}">Code on GitHub</a>. ${covered} Stripe and Shopify webhooks replay locally with test signatures; carrier and printer are fakes; Amazon is left out.`;

// autofocus serves a scanner at a desk. On a phone it would raise the keyboard and scroll past the slip.
if (touch) {
  // The browser applies autofocus just before the next frame, so undo it there.
  requestAnimationFrame(() => {
    if (document.activeElement === input) {
      input.blur();
      scrollTo(0, 0);
    }
  });
} else {
  focusScanner();
}
