// <define:__COVERAGE__>
var define_COVERAGE_default = { lines: { total: 460, covered: 460, skipped: 0, pct: 100 }, statements: { total: 513, covered: 512, skipped: 0, pct: 99.8 }, functions: { total: 96, covered: 96, skipped: 0, pct: 100 }, branches: { total: 96, covered: 94, skipped: 0, pct: 97.91 }, branchesTrue: { total: 0, covered: 0, skipped: 0, pct: 100 } };

// <define:__DEMO_STATE__>
var define_DEMO_STATE_default = {
  brand: "Aldane",
  packer: "J. Novak (fictional)",
  slip: {
    orderId: 104,
    customer: "A. Reyes",
    size: 8,
    sizeSubmittedAt: "2026-11-03T09:12:00.000Z",
    expectedUuid: "8e2f41c6-3b7a-4d19-a6e2-5f0c91d47c21",
    lot: "L-2304",
    labelCreatedAt: "2026-11-04T08:05:00.000Z",
    validatedAt: null,
    handedOffAt: null,
    deliveredAt: null,
    sizerDeliveredAt: "2026-11-02T14:40:00.000Z"
  },
  shipTo: {
    name: "A. Reyes",
    street: "210 Placeholder Ave",
    city: "Exampleton"
  },
  rings: [
    {
      uuid: "c17d0b52-92ee-4a08-b3f1-70ae6d2c3a90",
      qa: "passed",
      reservedFor: 99,
      lot: "L-2291",
      size: 8,
      intakeAt: "2026-10-19T08:52:00.000Z",
      status: "reserved"
    },
    {
      uuid: "f40a9e37-1c66-4b7d-8d25-19e3bb704d00",
      qa: "failed",
      reservedFor: null,
      lot: "L-2291",
      size: 8,
      intakeAt: "2026-10-19T08:40:00.000Z",
      status: "qa_failed"
    },
    {
      uuid: "8e2f41c6-3b7a-4d19-a6e2-5f0c91d47c21",
      qa: "passed",
      reservedFor: 104,
      lot: "L-2304",
      size: 8,
      intakeAt: "2026-10-26T09:24:00.000Z",
      status: "reserved"
    }
  ],
  why: {
    title: "Why ring …7C21 for order #104",
    line: "Order #104 got …7C21, the last size 8 ring ready to ship, because its size came in on Nov 3, 09:12 UTC, before order #105 on Nov 3, 16:40 UTC. Order #105 waits for the next ring.",
    history: [
      {
        at: "2026-10-26T09:10:00.000Z",
        kind: "manifest",
        actor: "M. Teller (fictional)",
        detail: "Lot L-2304, manifest line 1, size 8"
      },
      {
        at: "2026-10-26T09:24:00.000Z",
        kind: "intake",
        actor: "M. Teller (fictional)",
        detail: "Scanned in, lot L-2304"
      },
      {
        at: "2026-10-26T13:48:00.000Z",
        kind: "qa",
        actor: "R. Osei (fictional)",
        detail: "QA passed"
      },
      {
        at: "2026-11-03T09:12:00.000Z",
        kind: "size",
        actor: "customer",
        detail: "Size 8 submitted"
      },
      {
        at: "2026-11-03T09:12:00.000Z",
        kind: "reserved",
        actor: "system",
        detail: "Reserved for order #104"
      }
    ]
  },
  history: [
    {
      at: "2026-10-26T09:10:00.000Z",
      kind: "manifest",
      actor: "M. Teller (fictional)",
      detail: "Lot L-2304, manifest line 1, size 8"
    },
    {
      at: "2026-10-26T09:24:00.000Z",
      kind: "intake",
      actor: "M. Teller (fictional)",
      detail: "Scanned in, lot L-2304"
    },
    {
      at: "2026-10-26T13:48:00.000Z",
      kind: "qa",
      actor: "R. Osei (fictional)",
      detail: "QA passed"
    },
    {
      at: "2026-11-03T09:12:00.000Z",
      kind: "size",
      actor: "customer",
      detail: "Size 8 submitted"
    },
    {
      at: "2026-11-03T09:12:00.000Z",
      kind: "reserved",
      actor: "system",
      detail: "Reserved for order #104"
    }
  ],
  reservations: [
    {
      orderId: 99,
      uuid: "c17d0b52-92ee-4a08-b3f1-70ae6d2c3a90"
    },
    {
      orderId: 104,
      uuid: "8e2f41c6-3b7a-4d19-a6e2-5f0c91d47c21"
    }
  ],
  waiting: [
    {
      orderId: 105,
      submittedAt: "2026-11-03T16:40:00.000Z"
    }
  ]
};

// page/app.ts
import { checkScan, formatAt, orderLabel, suffix } from "./shared.js";

// page/code128.ts
var PATTERNS = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112"
];
var START_B = 104;
var STOP = 106;
function barcodeSvg(text, height = 48) {
  const codes = [...text].map((c) => c.charCodeAt(0) - 32);
  const checksum = codes.reduce((sum, code, i) => sum + code * (i + 1), START_B) % 103;
  const sequence = [START_B, ...codes, checksum, STOP];
  let x = 10;
  let bars = "";
  for (const code of sequence) {
    const widths = PATTERNS[code];
    for (let i = 0; i < widths.length; i += 1) {
      const w = Number(widths[i]);
      if (i % 2 === 0) bars += `M${x} 0h${w}v${height}h-${w}z`;
      x += w;
    }
  }
  const total = x + 10;
  return `<svg class="barcode" viewBox="0 0 ${total} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${bars}"/></svg>`;
}

// page/app.ts
var REPO = "https://github.com/fred1433/serialized-ring-ops";
var state = define_DEMO_STATE_default;
var report = null;
var coverage = define_COVERAGE_default;
var { slip } = state;
var order = orderLabel(slip.orderId);
var expected = suffix(slip.expectedUuid);
var motionOk = !matchMedia("(prefers-reduced-motion: reduce)").matches;
var touch = matchMedia("(pointer: coarse)").matches;
var $ = (id) => document.getElementById(id);
var esc = (text) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
var validatedAt = null;
var parcels = 0;
var refused = [];
var scanning = false;
$("slip-title").textContent = `Packing slip ${order} · Size ${slip.size}`;
$("ship-to").innerHTML = [state.shipTo.name, state.shipTo.street, state.shipTo.city].map(esc).join("<br>");
$("brand").textContent = `${state.brand} is a made-up brand.`;
$("expected-suffix").textContent = expected;
$("expected-uuid").textContent = slip.expectedUuid;
$("expected-meta").textContent = `Lot ${slip.lot}, size ${slip.size} submitted ${formatAt(slip.sizeSubmittedAt)}`;
$("sizer-line").textContent = `The sizer went in its own parcel, delivered ${formatAt(slip.sizerDeliveredAt)}. That delivery never counts as the ring being delivered.`;
function renderParcel() {
  const rows = [
    ["Carrier label created", formatAt(slip.labelCreatedAt)],
    ["Packing validated", validatedAt && formatAt(validatedAt)],
    ["Handed to carrier", null],
    ["Ring delivered", null],
    ["Eligible for pair-check", null]
  ];
  $("parcel-states").innerHTML = rows.map(([label, at]) => `<li class="${at ? "done" : ""}"><span class="box" aria-hidden="true"></span><span>${label}${at ? `<small>${at}</small>` : ""}<span class="sr">${at ? ": done" : ": not yet"}</span></span></li>`).join("");
}
renderParcel();
$("prompt").textContent = `Three size ${slip.size} rings on the bench. One belongs to this slip. Try one that does not.`;
$("stickers").innerHTML = state.rings.map(
  (ring, i) => `<button type="button" class="sticker s${i}" data-uuid="${ring.uuid}" aria-label="Scan ring ${suffix(ring.uuid)}">
      <span class="sticker-top"><span>${esc(state.brand)} ring</span><b>Size ${ring.size}</b></span>
      <span class="code">${barcodeSvg(ring.uuid)}<span class="laser"></span></span>
      <span class="sticker-id"><b>${suffix(ring.uuid)}</b><span>Lot ${esc(ring.lot)}</span></span>
      <span class="sticker-uuid">${ring.uuid}</span>
      <span class="sticker-action">Scan this ring</span>
    </button>`
).join("");
var units = state.rings.map(({ uuid, qa, reservedFor }) => ({ uuid, qa, reservedFor }));
var input = $("scan-input");
var stamp = $("stamp");
function focusScanner() {
  if (!touch) input.focus({ preventScroll: true });
}
function thud(text, kind) {
  stamp.className = `stamp ${kind}`;
  stamp.textContent = text;
  void stamp.offsetWidth;
  stamp.classList.add("on");
}
function nextHint() {
  const wrong = state.rings.find((r) => r.uuid !== slip.expectedUuid);
  return refused.length === 0 && wrong ? `Now try ${suffix(wrong.uuid)}. It is the same size.` : "";
}
function showResult(decision) {
  const box = $("result");
  box.dataset.outcome = decision.outcome;
  $("result-text").textContent = decision.message;
  if (decision.outcome === "blocked") {
    thud("Blocked", "refused");
    refused.push({ at: (/* @__PURE__ */ new Date()).toISOString(), kind: "scan_refused", actor: state.packer, detail: decision.message });
    $("result-note").textContent = "Both reservations are unchanged. The label stays printed; the parcel cannot leave. The refusal went into the packing history.";
    renderHistory();
  } else if (decision.outcome === "ready") {
    thud("Ready", "passed");
    validatedAt = (/* @__PURE__ */ new Date()).toISOString();
    parcels = 1;
    renderParcel();
    $("result-note").textContent = `Parcels validated for this order: ${parcels}. ${nextHint()}`.trim();
  } else {
    thud("Ready", "passed");
    $("result-note").textContent = `Parcels validated for this order: ${parcels}. A second scan adds nothing.`;
  }
  $("why-button").hidden = refused.length === 0;
  $("reset-button").hidden = false;
  if (box.getBoundingClientRect().bottom > innerHeight || box.getBoundingClientRect().top < 0) {
    box.scrollIntoView({ block: "center", behavior: motionOk ? "smooth" : "auto" });
  }
}
function runScan(value) {
  const decision = checkScan(value, { id: slip.orderId, expectedUuid: slip.expectedUuid, validated: validatedAt !== null }, units);
  showResult(decision);
  input.value = "";
  focusScanner();
}
$("scan-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (scanning) return;
  if (input.value.trim() === "") {
    $("result-text").textContent = "Scan a label, or type a full ring ID and press Enter.";
    focusScanner();
    return;
  }
  runScan(input.value);
});
$("stickers").addEventListener("click", (event) => {
  const sticker = event.target.closest(".sticker");
  if (!sticker || scanning) return;
  const uuid = sticker.dataset.uuid;
  if (!motionOk) {
    runScan(uuid);
    return;
  }
  scanning = true;
  sticker.classList.add("scanning");
  let shown = 0;
  const timer = setInterval(() => {
    shown += 4;
    input.value = uuid.slice(0, shown);
    if (shown >= uuid.length) {
      clearInterval(timer);
      sticker.classList.remove("scanning");
      scanning = false;
      runScan(uuid);
    }
  }, 22);
});
function renderHistory() {
  const row = (h, refusal) => `<li class="${refusal ? "refusal" : ""}"><time>${formatAt(h.at)}</time><span>${esc(h.detail)}</span><span class="who">${esc(h.actor[0].toUpperCase() + h.actor.slice(1))}</span></li>`;
  $("history").innerHTML = state.why.history.map((h) => row(h, false)).join("") + refused.map((h) => row(h, true)).join("");
}
$("why-title").textContent = state.why.title;
$("why-line").textContent = state.why.line;
$("held").textContent = `Held now: ${state.reservations.map((r) => `order ${orderLabel(r.orderId)} has ${suffix(r.uuid)}`).join(", ")}. Waiting: ${state.waiting.map((w) => `order ${orderLabel(w.orderId)}`).join(", ")}.`;
renderHistory();
var canary = $("canary");
var whyButton = $("why-button");
whyButton.addEventListener("click", () => {
  const open = canary.hidden;
  canary.hidden = !open;
  whyButton.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("why-open", open);
  if (open && motionOk) {
    canary.classList.remove("slide");
    void canary.offsetWidth;
    canary.classList.add("slide");
  }
  focusScanner();
});
$("reset-button").addEventListener("click", () => {
  validatedAt = null;
  parcels = 0;
  refused = [];
  renderParcel();
  renderHistory();
  stamp.className = "stamp";
  stamp.textContent = "";
  canary.hidden = true;
  document.body.classList.remove("why-open");
  whyButton.setAttribute("aria-expanded", "false");
  whyButton.hidden = true;
  $("reset-button").hidden = true;
  delete $("result").dataset.outcome;
  $("result-text").textContent = "Nothing scanned yet.";
  $("result-note").textContent = "";
  focusScanner();
});
var later = state.waiting[0];
$("step-a").textContent = `Order ${order} sends its size. Order ${later ? orderLabel(later.orderId) : ""} sends its size after it.`;
$("step-b").textContent = `The later order's database connection gets there first, which is the case that goes wrong if the rule is "whoever arrives".`;
$("step-c").textContent = "The earlier order still gets the ring. The later one waits, and one reservation exists for that ring.";
var roll = $("roll");
if (report) {
  const short = report.commit.slice(0, 7);
  $("witness-line").textContent = `To check that the test can fail at all, the same run reads the queue backwards on purpose. It failed ${report.witness.failed} of ${report.witness.runs} times, as it should.`;
  const rows = report.scenarios.map((s) => `<li><span>${esc(s.title)}</span><b>${s.passed}/${s.runs}</b></li>`).join("");
  roll.innerHTML = `<h3>Recorded test run</h3>
    <p class="roll-meta">${formatAt(report.recordedAt)}<br>Commit <a href="${REPO}/commit/${esc(report.commit)}">${esc(short)}</a><br>PostgreSQL ${esc(report.postgres)}</p>
    <ul>${rows}</ul>
    <p class="roll-witness"><span>${esc(report.witness.title)}</span><b>failed ${report.witness.failed}/${report.witness.runs}</b></p>
    <p class="roll-cmd">Replay it<code>${esc(report.command)}</code></p>`;
} else {
  roll.innerHTML = '<h3>Recorded test run</h3><p class="roll-meta">No recorded run in this build. Run the race report, then rebuild the page.</p>';
}
var covered = coverage ? `Test coverage ${Math.min(coverage.statements.pct, coverage.branches.pct, coverage.functions.pct, coverage.lines.pct)}% on its lowest measure.` : "Test coverage not recorded in this build.";
$("tech-line").innerHTML = `<a href="${REPO}">Code on GitHub</a>. ${covered} Stripe and Shopify webhooks replay locally with test signatures; carrier and printer are fakes; Amazon is left out.`;
focusScanner();
