import { checkScan, formatAt, HistoryEntry, orderLabel, ScanOutcome, ScanUnit, suffix, WhyAnswer } from '../src/shared';
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

let validatedAt: string | null = null;
let parcels = 0;
let refused: HistoryEntry[] = [];
let scanning = false;

/* The slip */
$('slip-title').textContent = `Packing slip ${order} · Size ${slip.size}`;
$('ship-to').innerHTML = [state.shipTo.name, state.shipTo.street, state.shipTo.city].map(esc).join('<br>');
$('brand').textContent = `${state.brand} is a made-up brand.`;
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
    ['Eligible for pair-check', null],
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
  return refused.length === 0 && wrong ? `Now try ${suffix(wrong.uuid)}. It is the same size.` : '';
}

function showResult(decision: ScanOutcome): void {
  const box = $('result');
  box.dataset.outcome = decision.outcome;
  $('result-text').textContent = decision.message;
  if (decision.outcome === 'blocked') {
    thud('Blocked', 'refused');
    refused.push({ at: new Date().toISOString(), kind: 'scan_refused', actor: state.packer, detail: decision.message });
    $('result-note').textContent = 'Both reservations are unchanged. The label stays printed; the parcel cannot leave. The refusal went into the packing history.';
    renderHistory();
  } else if (decision.outcome === 'ready') {
    thud('Ready', 'passed');
    validatedAt = new Date().toISOString();
    parcels = 1;
    renderParcel();
    $('result-note').textContent = `Parcels validated for this order: ${parcels}. ${nextHint()}`.trim();
  } else {
    thud('Ready', 'passed');
    $('result-note').textContent = `Parcels validated for this order: ${parcels}. A second scan adds nothing.`;
  }
  $('why-button').hidden = refused.length === 0;
  $('reset-button').hidden = false;
  if (box.getBoundingClientRect().bottom > innerHeight || box.getBoundingClientRect().top < 0) {
    box.scrollIntoView({ block: 'center', behavior: motionOk ? 'smooth' : 'auto' });
  }
}

function runScan(value: string): void {
  const decision = checkScan(value, { id: slip.orderId, expectedUuid: slip.expectedUuid, validated: validatedAt !== null }, units);
  showResult(decision);
  input.value = '';
  focusScanner();
}

$('scan-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (scanning) return;
  if (input.value.trim() === '') {
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
  const row = (h: HistoryEntry, refusal: boolean) =>
    `<li class="${refusal ? 'refusal' : ''}"><time>${formatAt(h.at)}</time><span>${esc(h.detail)}</span><span class="who">${esc(h.actor[0].toUpperCase() + h.actor.slice(1))}</span></li>`;
  $('history').innerHTML = state.why.history.map((h) => row(h, false)).join('') + refused.map((h) => row(h, true)).join('');
}

$('why-title').textContent = state.why.title;
$('why-line').textContent = state.why.line;
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
  refused = [];
  renderParcel();
  renderHistory();
  stamp.className = 'stamp';
  stamp.textContent = '';
  canary.hidden = true;
  document.body.classList.remove('why-open');
  whyButton.setAttribute('aria-expanded', 'false');
  whyButton.hidden = true;
  $('reset-button').hidden = true;
  delete $('result').dataset.outcome;
  $('result-text').textContent = 'Nothing scanned yet.';
  $('result-note').textContent = '';
  focusScanner();
});

/* The recorded result. Every number comes from reports/race-report.json. */
const later = state.waiting[0];
$('step-a').textContent = `Order ${order} sends its size. Order ${later ? orderLabel(later.orderId) : ''} sends its size after it.`;
$('step-b').textContent = `The later order's database connection gets there first, which is the case that goes wrong if the rule is "whoever arrives".`;
$('step-c').textContent = 'The earlier order still gets the ring. The later one waits, and one reservation exists for that ring.';

const roll = $('roll');
if (report) {
  const short = report.commit.slice(0, 7);
  $('witness-line').textContent = `To check that the test can fail at all, the same run reads the queue backwards on purpose. It failed ${report.witness.failed} of ${report.witness.runs} times, as it should.`;
  const rows = report.scenarios
    .map((s) => `<li><span>${esc(s.title)}</span><b>${s.passed}/${s.runs}</b></li>`)
    .join('');
  roll.innerHTML = `<h3>Recorded test run</h3>
    <p class="roll-meta">${formatAt(report.recordedAt)}<br>Commit <a href="${REPO}/commit/${esc(report.commit)}">${esc(short)}</a><br>PostgreSQL ${esc(report.postgres)}</p>
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

focusScanner();
