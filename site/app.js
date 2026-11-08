// <define:__COVERAGE__>
var define_COVERAGE_default = { lines: { total: 497, covered: 497, skipped: 0, pct: 100 }, statements: { total: 558, covered: 558, skipped: 0, pct: 100 }, functions: { total: 102, covered: 102, skipped: 0, pct: 100 }, branches: { total: 129, covered: 127, skipped: 0, pct: 98.44 }, branchesTrue: { total: 0, covered: 0, skipped: 0, pct: 100 } };

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
    reservedAt: "2026-11-03T09:12:00.000Z",
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
    line: "Order #104 sent its size on Nov 3, 09:12 UTC and has held …7C21 since Nov 3, 09:12 UTC. No size 8 ring is free now. Order #105 sent its size later, on Nov 3, 16:40 UTC, and waits for the next ring.",
    history: [
      {
        at: "2026-10-26T09:10:00.000Z",
        kind: "manifest",
        actor: "M. Teller (fictional)",
        detail: "Lot L-2304, manifest line 1, size 8",
        scanned: null
      },
      {
        at: "2026-10-26T09:24:00.000Z",
        kind: "intake",
        actor: "M. Teller (fictional)",
        detail: "Scanned in, lot L-2304",
        scanned: null
      },
      {
        at: "2026-10-26T13:48:00.000Z",
        kind: "qa",
        actor: "R. Osei (fictional)",
        detail: "QA passed",
        scanned: null
      },
      {
        at: "2026-11-02T14:40:00.000Z",
        kind: "sizer_delivered",
        actor: "carrier",
        detail: "Sizer delivered (simulated)",
        scanned: null
      },
      {
        at: "2026-11-03T09:12:00.000Z",
        kind: "size",
        actor: "customer",
        detail: "Size 8 submitted",
        scanned: null
      },
      {
        at: "2026-11-03T09:12:00.000Z",
        kind: "reserved",
        actor: "system",
        detail: "Reserved for order #104",
        scanned: null
      },
      {
        at: "2026-11-04T08:05:00.000Z",
        kind: "label",
        actor: "J. Novak (fictional)",
        detail: "Ring label created (fake carrier)",
        scanned: null
      }
    ]
  },
  history: [
    {
      at: "2026-10-26T09:10:00.000Z",
      kind: "manifest",
      actor: "M. Teller (fictional)",
      detail: "Lot L-2304, manifest line 1, size 8",
      scanned: null
    },
    {
      at: "2026-10-26T09:24:00.000Z",
      kind: "intake",
      actor: "M. Teller (fictional)",
      detail: "Scanned in, lot L-2304",
      scanned: null
    },
    {
      at: "2026-10-26T13:48:00.000Z",
      kind: "qa",
      actor: "R. Osei (fictional)",
      detail: "QA passed",
      scanned: null
    },
    {
      at: "2026-11-02T14:40:00.000Z",
      kind: "sizer_delivered",
      actor: "carrier",
      detail: "Sizer delivered (simulated)",
      scanned: null
    },
    {
      at: "2026-11-03T09:12:00.000Z",
      kind: "size",
      actor: "customer",
      detail: "Size 8 submitted",
      scanned: null
    },
    {
      at: "2026-11-03T09:12:00.000Z",
      kind: "reserved",
      actor: "system",
      detail: "Reserved for order #104",
      scanned: null
    },
    {
      at: "2026-11-04T08:05:00.000Z",
      kind: "label",
      actor: "J. Novak (fictional)",
      detail: "Ring label created (fake carrier)",
      scanned: null
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

// <define:__RACE_REPORT__>
var define_RACE_REPORT_default = {
  recordedAt: "2026-11-08T13:54:37.050Z",
  commit: "379136014fa71d92d7e5c1334cca41c5301a0796",
  postgres: "17.11",
  command: "docker compose run --build --rm race",
  scenarios: [
    {
      key: "forced_order",
      title: "The later order's connection moves first",
      expectation: "The earlier order gets the ring, the later one waits, one reservation exists.",
      passed: 50,
      runs: 50
    },
    {
      key: "stock_order",
      title: "Older ring failed QA, two eligible rings of different dates",
      expectation: "The older of the two eligible rings is given.",
      passed: 50,
      runs: 50
    },
    {
      key: "rollback_release",
      title: "The lock holder rolls back while another connection waits",
      expectation: "The waiting connection looks again and serves the ring.",
      passed: 50,
      runs: 50
    },
    {
      key: "cancel_handover",
      title: "The first order cancels",
      expectation: "The waiting order gets the ring without sending its size again.",
      passed: 50,
      runs: 50
    },
    {
      key: "open_race",
      title: "Twelve orders hit one ring with no forced order",
      expectation: "One reservation, eleven orders waiting.",
      passed: 50,
      runs: 50
    }
  ],
  witness: {
    title: "Same test, with the queue read backwards on purpose",
    runs: 50,
    failed: 50
  }
};

// page/app.ts
import { checkScan, formatAt, formatDated, orderLabel, suffix } from "./shared.js";

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
var report = define_RACE_REPORT_default;
var coverage = define_COVERAGE_default;
var { slip } = state;
var order = orderLabel(slip.orderId);
var expected = suffix(slip.expectedUuid);
var motionOk = !matchMedia("(prefers-reduced-motion: reduce)").matches;
var touch = matchMedia("(pointer: coarse)").matches;
var $ = (id) => document.getElementById(id);
var esc = (text) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
var setVerdict = (el, text) => {
  el.innerHTML = esc(text).replace(/…[0-9A-F]{4}/g, '<span class="id">$&</span>');
};
var validatedAt = null;
var parcels = 0;
var refusals = 0;
var scans = [];
var scanning = false;
$("slip-title").textContent = `Packing slip ${order} · Size ${slip.size}`;
$("ship-to").innerHTML = [state.shipTo.name, state.shipTo.street, state.shipTo.city].map(esc).join("<br>");
$("brand").textContent = `${state.brand} is a made-up brand.`;
$("packer").textContent = `Packer: ${state.packer}`;
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
    ["Eligible to pair", null]
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
  return refusals === 0 && wrong ? `To see a refusal, start over and scan ${suffix(wrong.uuid)} first.` : "";
}
function logScan(kind, detail, scanned) {
  scans.push({ at: (/* @__PURE__ */ new Date()).toISOString(), kind, actor: state.packer, detail, scanned });
  renderHistory();
}
function refusalNote(reason) {
  const logged = "The refusal went into the packing history.";
  if (reason === "other-order") return `Both reservations are unchanged. The label stays printed; the parcel cannot leave. ${logged}`;
  if (reason === "failed-qa") return `This ring has no reservation to change, and it stays out of every parcel. The parcel still needs ${expected}. ${logged}`;
  return `No reservation changed. The parcel still needs ${expected}. ${logged}`;
}
function clearVerdict() {
  delete $("result").dataset.outcome;
  stamp.className = "stamp";
  stamp.textContent = "";
  $("result-note").textContent = "";
}
function showResult(decision, scanned) {
  const box = $("result");
  box.dataset.outcome = decision.outcome;
  setVerdict($("result-text"), decision.message);
  if (decision.outcome === "blocked") {
    thud("Blocked", "refused");
    refusals += 1;
    logScan("scan_refused", decision.message, scanned);
    $("result-note").textContent = refusalNote(decision.reason);
  } else if (decision.outcome === "rejected") {
    thud("Rejected", "refused");
    refusals += 1;
    logScan("scan_refused", decision.message, scanned);
    $("result-note").textContent = `This ring stays off the parcel. The parcel validated with ${expected} is unchanged. The refusal went into the packing history.`;
  } else if (decision.outcome === "ready" || decision.outcome === "validated-no-label") {
    thud("Ready", "passed");
    validatedAt = (/* @__PURE__ */ new Date()).toISOString();
    parcels = 1;
    renderParcel();
    logScan("scan_accepted", decision.message, scanned);
    $("result-note").textContent = `Parcels validated for this order: ${parcels}. ${nextHint()}`.trim();
  } else {
    thud("Ready", "passed");
    logScan("scan_repeated", decision.message, scanned);
    $("result-note").textContent = `Parcels validated for this order: ${parcels}. A second scan adds nothing.`;
  }
  $("why-button").hidden = refusals === 0;
  $("reset-button").hidden = false;
  const tray = $("rings");
  const floor = getComputedStyle(tray).position === "sticky" ? tray.getBoundingClientRect().top : innerHeight;
  if (box.getBoundingClientRect().bottom > floor || box.getBoundingClientRect().top < 0) {
    const rect = box.getBoundingClientRect();
    const top = scrollY + rect.top - Math.max(8, (floor - rect.height) / 2);
    scrollTo({ top, behavior: motionOk ? "smooth" : "auto" });
  }
}
function runScan(value) {
  const decision = checkScan(value, { id: slip.orderId, expectedUuid: slip.expectedUuid, validated: validatedAt !== null, labelled: slip.labelCreatedAt !== null }, units);
  showResult(decision, value.trim());
  input.value = "";
  focusScanner();
}
$("scan-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (scanning) return;
  if (input.value.trim() === "") {
    clearVerdict();
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
  const tone = { scan_refused: "refusal", scan_accepted: "accepted", scan_repeated: "accepted" };
  const row = (h) => `<li class="${tone[h.kind] ?? ""}"><time>${formatAt(h.at)}</time><span>${esc(h.detail)}${h.kind === "scan_refused" && h.scanned ? `<small>Scanned: ${esc(h.scanned)}</small>` : ""}</span><span class="who">${esc(h.actor[0].toUpperCase() + h.actor.slice(1))}</span></li>`;
  $("history").innerHTML = [...state.why.history, ...scans].map(row).join("");
}
$("why-title").textContent = state.why.title;
setVerdict($("why-line"), state.why.line);
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
  refusals = 0;
  scans = [];
  renderParcel();
  renderHistory();
  clearVerdict();
  canary.hidden = true;
  document.body.classList.remove("why-open");
  whyButton.setAttribute("aria-expanded", "false");
  whyButton.hidden = true;
  $("reset-button").hidden = true;
  $("result-text").textContent = "Nothing scanned yet.";
  focusScanner();
});
var roll = $("roll");
if (report) {
  const short = report.commit.slice(0, 7);
  const forced = report.scenarios.find((s) => s.key === "forced_order");
  if (forced && forced.passed === forced.runs) {
    $("proof-claim").textContent = `The earlier order got the last ring in all ${forced.runs} runs, even when the later order's connection moved first.`;
  }
  $("witness-line").textContent = `To check that the test can fail at all, the same run reads the queue backwards on purpose. It failed ${report.witness.failed} of ${report.witness.runs} times, as it should.`;
  const rows = report.scenarios.map((s) => `<li><span>${esc(s.title)}</span><b>${s.passed}/${s.runs}</b></li>`).join("");
  roll.innerHTML = `<h3>Recorded test run</h3>
    <p class="roll-meta">${formatDated(report.recordedAt)}<br>Commit <a href="${REPO}/commit/${esc(report.commit)}">${esc(short)}</a><br>PostgreSQL ${esc(report.postgres)}</p>
    <ul>${rows}</ul>
    <p class="roll-witness"><span>${esc(report.witness.title)}</span><b>failed ${report.witness.failed}/${report.witness.runs}</b></p>
    <p class="roll-cmd">Replay it<code>${esc(report.command)}</code></p>`;
} else {
  roll.innerHTML = '<h3>Recorded test run</h3><p class="roll-meta">No recorded run in this build. Run the race report, then rebuild the page.</p>';
}
var covered = coverage ? `Test coverage ${Math.min(coverage.statements.pct, coverage.branches.pct, coverage.functions.pct, coverage.lines.pct)}% on its lowest measure.` : "Test coverage not recorded in this build.";
$("tech-line").innerHTML = `<a href="${REPO}">Code on GitHub</a>. ${covered} Stripe and Shopify webhooks replay locally with test signatures; carrier and printer are fakes; Amazon is left out.`;
if (touch) {
  requestAnimationFrame(() => {
    if (document.activeElement === input) {
      input.blur();
      scrollTo(0, 0);
    }
  });
} else {
  focusScanner();
}
