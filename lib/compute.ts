import { fdate } from "./format";
import type {
  AppData,
  Bucket,
  CapitalFlow,
  CoinAgg,
  Fill,
  LedgerEvent,
  Metric,
  Period,
  Position,
  Range,
} from "./types";

export const PERIODS: [Period, string][] = [
  ["day", "24H"],
  ["week", "7D"],
  ["month", "30D"],
  ["allTime", "ALL"],
];

export function currentWin(D: AppData, period: Period, range: Range | null): Range | null {
  if (period === "custom" && range) return { ...range };
  if (period === "allTime") return null;
  const h = D.pmap[period]?.pnlHistory;
  return h?.length ? { start: +h[0][0], end: Date.now() } : null;
}

export function winLabel(period: Period, range: Range | null): string {
  if (period === "custom" && range) return `${fdate(range.start)} \u2013 ${fdate(range.end)}`;
  if (period === "allTime") return "all time";
  return PERIODS.find((p) => p[0] === period)![1];
}

export function seriesFor(
  D: AppData,
  period: Period,
  range: Range | null,
  metric: Metric
): { t: number; v: number }[] {
  const key = period === "custom" ? "allTime" : period;
  const p = D.pmap[key];
  if (!p) return [];
  const src = metric === "pnl" ? p.pnlHistory : p.accountValueHistory;
  let s = (src || []).map(([t, v]) => ({ t: +t, v: +v }));
  if (period === "custom" && range) {
    s = s.filter((pt) => pt.t >= range.start && pt.t <= range.end);
    if (metric === "pnl" && s.length) {
      const base = s[0].v;
      s = s.map((pt) => ({ t: pt.t, v: pt.v - base }));
    }
  }
  return s;
}

export function rangePnl(D: AppData, range: Range): number {
  const h = D.pmap.allTime?.pnlHistory || [];
  const inR = h.filter(([t]) => +t >= range.start && +t <= range.end);
  return inR.length ? +inR[inR.length - 1][1] - +inR[0][1] : 0;
}

export function periodPnl(D: AppData, key: string): number {
  const h = D.pmap[key]?.pnlHistory || [];
  return h.length ? +h[h.length - 1][1] - +h[0][1] : 0;
}

export function buildBuckets(
  D: AppData,
  win: Range | null,
  activeLedger: LedgerEvent[] | undefined,
  currentUser: string | null
): { arr: Bucket[]; daily: boolean } {
  const h = D.pmap.allTime?.pnlHistory || [];
  let pts = h.map(([t, v]) => ({ t: +t, v: +v }));
  if (win) pts = pts.filter((p) => p.t >= win.start && p.t <= win.end);
  const spanDays =
    pts.length > 1
      ? (pts[pts.length - 1].t - pts[0].t) / 86400000
      : win
        ? (win.end - win.start) / 86400000
        : Infinity;
  const daily = !!win && spanDays <= 92;
  const keyOf = (t: number) => {
    const d = new Date(t);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return daily ? `${m}-${String(d.getDate()).padStart(2, "0")}` : m;
  };
  const labelOf = (t: number) =>
    new Date(t).toLocaleDateString(
      "en-GB",
      daily ? { day: "numeric", month: "short" } : { month: "short", year: "2-digit" }
    );
  const map = new Map<string, Bucket>();
  const get = (k: string, t: number): Bucket => {
    if (!map.has(k)) map.set(k, { k, t, lastPnl: null, dep: 0, wd: 0, pnl: 0, label: "" });
    return map.get(k)!;
  };
  for (const p of pts) get(keyOf(p.t), p.t).lastPnl = p.v;
  for (const ev of activeLedger || []) {
    const f = flowOf(ev, currentUser);
    if (!f) continue;
    if (win && (ev.time < win.start || ev.time > win.end)) continue;
    const b = get(keyOf(ev.time), ev.time);
    if (f.dir === "in") b.dep += f.amt;
    else b.wd += f.amt;
  }
  const arr = [...map.values()].sort((a, b) => a.t - b.t);
  let prev = pts.length ? pts[0].v : 0;
  for (const b of arr) {
    if (b.lastPnl === null) b.pnl = 0;
    else {
      b.pnl = b.lastPnl - prev;
      prev = b.lastPnl;
    }
    b.label = labelOf(b.t);
  }
  return { arr, daily };
}

export function spotPrices(D: AppData): Record<string, number> {
  const res: Record<string, number> = { USDC: 1 };
  const sc = D.spotCtx;
  if (!Array.isArray(sc) || sc.length < 2) return res;
  const [meta, ctxs] = sc;
  const tok = (i: number) => meta.tokens?.[i]?.name;
  (meta.universe || []).forEach((pair, i) => {
    const [b, q] = pair.tokens || [];
    const mid = +(ctxs?.[i]?.midPx || 0);
    const base = tok(b);
    if (base && tok(q) === "USDC" && mid && !(base in res)) res[base] = mid;
  });
  return res;
}

export function accountBreakdown(D: AppData) {
  const px = spotPrices(D);
  const perp = +(D.clearing?.marginSummary?.accountValue || 0);
  const spot = (D.spot?.balances || []).reduce((s, b) => s + (+b.total || 0) * (px[b.coin] ?? 0), 0);
  const vault = (Array.isArray(D.vaults) ? D.vaults : []).reduce((s, v) => s + (+v.equity || 0), 0);
  const st = D.staking;
  const hype = px["HYPE"] || 0;
  const staked = st
    ? ((+st.delegated! || 0) + (+st.undelegated! || 0) + (+st.totalPendingWithdrawal! || 0)) * hype
    : 0;
  return { perp, spot, vault, staked, total: perp + spot + vault + staked };
}

export function livePnl(p: Position, mark: number | undefined): Position {
  const szi = +p.szi;
  const entry = +p.entryPx;
  if (!mark || !isFinite(mark) || !szi || !entry) return p;
  const pnl = szi * (mark - entry);
  const lev = p.leverage?.value;
  const margin = (Math.abs(szi) * entry) / (lev && lev > 0 ? lev : 1);
  const roe = margin ? pnl / margin : +p.returnOnEquity;
  return { ...p, unrealizedPnl: String(pnl), returnOnEquity: String(roe) };
}

export function flowOf(ev: LedgerEvent | undefined, currentUser: string | null): CapitalFlow | null {
  const d = ev?.delta || {};
  const ty = d.type;
  const me = (currentUser || "").toLowerCase();
  const amt = Math.abs(+(d.usdc ?? d.usdcValue ?? d.amount ?? 0));
  if (!amt) return null;
  if (ty === "deposit") return { dir: "in", kind: "Deposit", amt };
  if (ty === "withdraw") return { dir: "out", kind: "Withdrawal", amt, fee: +d.fee! || 0 };
  if (ty === "internalTransfer" || ty === "spotTransfer" || ty === "usdSend" || ty === "send") {
    const dest = (d.destination || "").toLowerCase();
    const from = (d.user || "").toLowerCase();
    if (dest && dest !== me) return { dir: "out", kind: "Transfer out", amt, fee: +d.fee! || 0, to: d.destination };
    if (dest === me && from && from !== me) return { dir: "in", kind: "Transfer in", amt };
  }
  return null;
}

export function byCoin(fills: Fill[] | undefined): CoinAgg[] {
  const agg: Record<string, CoinAgg> = {};
  for (const f of fills || []) {
    const a = (agg[f.coin] ||= { coin: f.coin, realized: 0, fees: 0, trades: 0, wins: 0, closes: 0, net: 0 });
    const p = +f.closedPnl! || 0;
    a.realized += p;
    a.fees += +f.fee! || 0;
    a.trades++;
    if (p !== 0) {
      a.closes++;
      if (p > 0) a.wins++;
    }
  }
  return Object.values(agg)
    .map((a) => ({ ...a, net: a.realized - a.fees }))
    .sort((x, y) => y.net - x.net);
}
