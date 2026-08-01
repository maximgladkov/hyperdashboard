import type { Fill, FundingEvent, PositionRecord } from "./types";

type Trip = {
  coin: string;
  side: "long" | "short";
  openedAt: number;
  closedAt: number | null;
  entrySize: number;
  entryNotional: number;
  closeSize: number;
  closeNotional: number;
  peakSize: number;
  currentSize: number;
  realized: number;
  fees: number;
  fills: number;
  carriedIn: boolean;
  derivedEntry: number | null;
  firstTid: number;
};

function signedSize(side: "B" | "A" | undefined, sz: number): number {
  return side === "A" ? -sz : sz;
}

function sideOf(pos: number): "long" | "short" {
  return pos > 0 ? "long" : "short";
}

function deriveEntry(side: "long" | "short", px: number, pnl: number, qty: number): number {
  if (!qty) return px;
  return side === "long" ? px - pnl / qty : px + pnl / qty;
}

function finalize(trip: Trip, funding: number): PositionRecord {
  const avgEntry =
    trip.carriedIn && trip.derivedEntry != null
      ? trip.derivedEntry
      : trip.entrySize > 0
        ? trip.entryNotional / trip.entrySize
        : trip.derivedEntry ?? 0;
  const avgClose = trip.closeSize > 0 ? trip.closeNotional / trip.closeSize : null;
  const size = trip.peakSize;
  const notional = size * avgEntry;
  const net = trip.realized - trip.fees + funding;
  const status: PositionRecord["status"] =
    trip.closedAt == null ? "open" : trip.carriedIn ? "partial" : "closed";
  return {
    id: `${trip.coin}-${trip.firstTid}-${trip.closedAt ?? "open"}`,
    coin: trip.coin,
    side: trip.side,
    status,
    openedAt: trip.openedAt,
    closedAt: trip.closedAt,
    size,
    notional,
    avgEntry,
    avgClose,
    realized: trip.realized,
    fees: trip.fees,
    funding,
    net,
    roi: notional ? net / notional : 0,
    fills: trip.fills,
  };
}

function seedTrip(coin: string, pos: number, time: number, tid: number, carriedIn: boolean): Trip {
  const abs = Math.abs(pos);
  return {
    coin,
    side: sideOf(pos),
    openedAt: time,
    closedAt: null,
    entrySize: carriedIn ? 0 : abs,
    entryNotional: 0,
    closeSize: 0,
    closeNotional: 0,
    peakSize: abs,
    currentSize: abs,
    realized: 0,
    fees: 0,
    fills: 0,
    carriedIn,
    derivedEntry: null,
    firstTid: tid,
  };
}

function applyOpen(trip: Trip, qty: number, px: number, fee: number, time: number, afterAbs: number) {
  trip.entrySize += qty;
  trip.entryNotional += px * qty;
  trip.fees += fee;
  trip.fills += 1;
  trip.currentSize = afterAbs;
  if (afterAbs > trip.peakSize) trip.peakSize = afterAbs;
  if (time < trip.openedAt) trip.openedAt = time;
}

function applyClose(trip: Trip, qty: number, px: number, fee: number, pnl: number, time: number, afterAbs: number) {
  trip.closeSize += qty;
  trip.closeNotional += px * qty;
  trip.fees += fee;
  trip.realized += pnl;
  trip.fills += 1;
  trip.currentSize = afterAbs;
  if (trip.carriedIn && trip.derivedEntry == null && qty > 0) {
    trip.derivedEntry = deriveEntry(trip.side, px, pnl, qty);
  }
  trip.closedAt = time;
}

export function buildPositionHistory(
  fills: Fill[] | undefined,
  funding: FundingEvent[] | undefined
): PositionRecord[] {
  const byCoin = new Map<string, Fill[]>();
  for (const f of fills || []) {
    if (!f.coin || !f.sz || !f.px) continue;
    const list = byCoin.get(f.coin);
    if (list) list.push(f);
    else byCoin.set(f.coin, [f]);
  }

  const trips: Trip[] = [];

  for (const [coin, coinFills] of byCoin) {
    coinFills.sort((a, b) => a.time - b.time || (a.tid ?? 0) - (b.tid ?? 0));

    let active: Trip | null = null;

    for (const f of coinFills) {
      const start = +(f.startPosition ?? 0);
      const sz = +f.sz!;
      const px = +f.px!;
      if (!sz || !px) continue;

      const signed = signedSize(f.side, sz);
      const after = start + signed;
      const fee = +f.fee! || 0;
      const pnl = +f.closedPnl! || 0;
      const tid = f.tid ?? f.oid ?? f.time;

      let closeQty = 0;
      let openQty = 0;
      if (start === 0 || Math.sign(start) === Math.sign(signed)) {
        openQty = sz;
      } else {
        closeQty = Math.min(sz, Math.abs(start));
        openQty = sz - closeQty;
      }

      const closeFee = closeQty > 0 ? fee * (closeQty / sz) : 0;
      const openFee = openQty > 0 ? fee * (openQty / sz) : 0;

      if (start !== 0 && !active) {
        active = seedTrip(coin, start, f.time, tid, true);
      }

      if (closeQty > 0 && active) {
        const afterClose = openQty > 0 ? 0 : Math.abs(after);
        applyClose(active, closeQty, px, closeFee, pnl, f.time, afterClose);
        if (after === 0 || openQty > 0) {
          trips.push(active);
          active = null;
        }
      }

      if (openQty > 0) {
        const openSigned = Math.sign(signed) * openQty;
        const afterOpen = Math.abs(after);
        if (!active) {
          active = seedTrip(coin, openSigned, f.time, tid, false);
          active.entrySize = 0;
          active.currentSize = 0;
          active.peakSize = 0;
        }
        applyOpen(active, openQty, px, openFee, f.time, afterOpen);
      } else if (closeQty === 0 && active) {
        active.fills += 1;
        active.fees += fee;
      }
    }

    if (active) trips.push(active);
  }

  const fundingByCoin = new Map<string, FundingEvent[]>();
  for (const ev of funding || []) {
    const coin = ev.delta?.coin;
    if (!coin) continue;
    const list = fundingByCoin.get(coin);
    if (list) list.push(ev);
    else fundingByCoin.set(coin, [ev]);
  }

  const records = trips.map((trip) => {
    const events = fundingByCoin.get(trip.coin) || [];
    let fund = 0;
    for (const ev of events) {
      if (ev.time < trip.openedAt) continue;
      if (trip.closedAt != null && ev.time > trip.closedAt) continue;
      fund += +(ev.delta?.usdc || 0);
    }
    return finalize(trip, fund);
  });

  return records.sort((a, b) => (b.closedAt ?? b.openedAt) - (a.closedAt ?? a.openedAt));
}
