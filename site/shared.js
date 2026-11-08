// src/shared/scan-check.ts
var FULL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function suffix(uuid) {
  return `…${uuid.slice(-4).toUpperCase()}`;
}
function orderLabel(id) {
  return `#${String(id).padStart(3, "0")}`;
}
function checkScan(input, order, units) {
  const scanned = input.trim().toLowerCase();
  if (order.validated && scanned !== order.expectedUuid) {
    return {
      outcome: "rejected",
      reason: "already-packed",
      message: `Scan rejected. Order ${orderLabel(order.id)} is already packed with ${suffix(order.expectedUuid)}.`
    };
  }
  if (!FULL_ID.test(scanned)) {
    return {
      outcome: "blocked",
      reason: "malformed",
      message: "Packing blocked. That is not a full ring ID. Scan the whole label."
    };
  }
  const unit = units.find((u) => u.uuid === scanned);
  if (!unit) {
    return {
      outcome: "blocked",
      reason: "unknown",
      message: `Packing blocked. Ring ${suffix(scanned)} is not in this stock.`
    };
  }
  if (unit.qa === "failed") {
    return { outcome: "blocked", reason: "failed-qa", message: `Packing blocked. Ring ${suffix(scanned)} failed QA.` };
  }
  if (order.expectedUuid === null) {
    return {
      outcome: "blocked",
      reason: "no-reservation",
      message: `Packing blocked. Order ${orderLabel(order.id)} has no ring reserved yet.`
    };
  }
  const expected = suffix(order.expectedUuid);
  if (scanned !== order.expectedUuid) {
    if (unit.reservedFor !== null) {
      return {
        outcome: "blocked",
        reason: "other-order",
        message: `Packing blocked. Ring ${suffix(scanned)} belongs to order ${orderLabel(unit.reservedFor)}. Expected ${expected}.`
      };
    }
    return {
      outcome: "blocked",
      reason: "not-reserved",
      message: `Packing blocked. Ring ${suffix(scanned)} is not reserved for this order. Expected ${expected}.`
    };
  }
  if (order.validated) {
    return {
      outcome: "already-validated",
      message: `Already validated. Still one parcel for order ${orderLabel(order.id)}.`
    };
  }
  if (!order.labelled) {
    return { outcome: "validated-no-label", message: "Packing validated. Create a carrier label before handoff." };
  }
  return { outcome: "ready", message: "Ready for carrier handoff" };
}

// src/shared/why.ts
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatAt(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
function formatDated(iso) {
  const d = new Date(iso);
  return formatAt(iso).replace(", ", `, ${d.getUTCFullYear()}, `);
}
function stockNow(free, size) {
  if (free === 0) return `No size ${size} ring is free now.`;
  return free === 1 ? `1 size ${size} ring is free now.` : `${free} size ${size} rings are free now.`;
}
function explainWhy(input) {
  const ring = suffix(input.uuid);
  const held = `Order ${orderLabel(input.orderId)} sent its size on ${formatAt(input.submittedAt)} and has held ${ring} since ${formatAt(input.reservedAt)}.`;
  const next = input.waiting[0];
  const queue = next ? `Order ${orderLabel(next.orderId)} sent its size later, on ${formatAt(next.submittedAt)}, and waits for the next ring.` : "No order is waiting.";
  return {
    title: `Why ring ${ring} for order ${orderLabel(input.orderId)}`,
    line: `${held} ${stockNow(input.freeNow, input.size)} ${queue}`,
    history: input.history
  };
}
export {
  checkScan,
  explainWhy,
  formatAt,
  formatDated,
  orderLabel,
  suffix
};
