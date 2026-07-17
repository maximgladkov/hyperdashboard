"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import CapitalFlows from "@/components/CapitalFlows";
import ChartPanel from "@/components/ChartPanel";
import FlowsPanel from "@/components/FlowsPanel";
import FundingPanel from "@/components/FundingPanel";
import MarketTable from "@/components/MarketTable";
import Positions from "@/components/Positions";
import StatsStrip from "@/components/StatsStrip";
import Toast from "@/components/Toast";
import {
  PERIODS,
  accountBreakdown,
  buildBuckets,
  byCoin,
  currentWin,
  flowOf,
  periodPnl,
  rangePnl,
  seriesFor,
  winLabel,
} from "@/lib/compute";
import { fetchRange, info } from "@/lib/hyperliquid";
import type {
  AppData,
  ClearinghouseState,
  DelegatorSummary,
  Metric,
  Period,
  PortfolioPeriodData,
  Range,
  SpotClearinghouseState,
  SpotCtx,
  VaultEquity,
  WinData,
} from "@/lib/types";

const DEFAULT_ADDR = "0x78e497a06B12d767371389EbD04baF7C8225a98b";
const ADDR_STORAGE_KEY = "hlpnl:addr";
const STALE_MS = 60 * 1000;

type ToastState = { message: string; isError: boolean; hidden: boolean };

type State = {
  D: AppData | null;
  currentUser: string | null;
  period: Period;
  metric: Metric;
  range: Range | null;
  winData: WinData | null;
  rsVal: string;
  reVal: string;
  pendingPeriod: Period | null;
  toast: ToastState;
  loading: boolean;
  error: string | null;
};

const initialState: State = {
  D: null,
  currentUser: null,
  period: "month",
  metric: "pnl",
  range: null,
  winData: null,
  rsVal: "",
  reVal: "",
  pendingPeriod: null,
  toast: { message: "", isError: false, hidden: true },
  loading: true,
  error: null,
};

type Action =
  | { type: "LOAD_START"; soft: boolean }
  | { type: "LOAD_SUCCESS"; D: AppData; currentUser: string; winData: WinData; period: Period; range: Range | null }
  | { type: "LOAD_ERROR"; soft: boolean; message: string }
  | { type: "SET_METRIC"; metric: Metric }
  | { type: "PERIOD_PENDING"; period: Period }
  | { type: "PERIOD_SUCCESS"; period: Period; range: Range | null; winData: WinData }
  | { type: "PERIOD_ERROR" }
  | { type: "SET_RS"; value: string }
  | { type: "SET_RE"; value: string }
  | { type: "SHOW_TOAST"; message: string; isError: boolean }
  | { type: "HIDE_TOAST" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_START":
      return action.soft ? state : { ...state, loading: true, error: null };
    case "LOAD_SUCCESS":
      return {
        ...state,
        D: action.D,
        currentUser: action.currentUser,
        winData: action.winData,
        period: action.period,
        range: action.range,
        loading: false,
        error: null,
      };
    case "LOAD_ERROR":
      return action.soft ? state : { ...state, loading: false, error: action.message };
    case "SET_METRIC":
      return { ...state, metric: action.metric };
    case "PERIOD_PENDING":
      return { ...state, pendingPeriod: action.period };
    case "PERIOD_SUCCESS":
      return { ...state, period: action.period, range: action.range, winData: action.winData, pendingPeriod: null };
    case "PERIOD_ERROR":
      return { ...state, pendingPeriod: null };
    case "SET_RS":
      return { ...state, rsVal: action.value };
    case "SET_RE":
      return { ...state, reVal: action.value };
    case "SHOW_TOAST":
      return { ...state, toast: { message: action.message, isError: action.isError, hidden: false } };
    case "HIDE_TOAST":
      return { ...state, toast: { ...state.toast, hidden: true } };
    default:
      return state;
  }
}

type PortfolioEntry = [string, PortfolioPeriodData];

async function computeWinData(
  D: AppData,
  user: string,
  period: Period,
  range: Range | null,
  cache: Map<string, WinData>
): Promise<WinData> {
  const w = currentWin(D, period, range);
  const key = period === "custom" && range ? `c:${range.start}-${range.end}` : period;
  const cached = cache.get(key);
  if (cached) return cached;
  const data = await fetchRange(user, w ? w.start : 0, w ? w.end : Date.now());
  cache.set(key, data);
  return data;
}

function safe<T>(p: Promise<T>): Promise<T | null> {
  return p.catch(() => null);
}

export default function Dashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [addrInput, setAddrInput] = useState(DEFAULT_ADDR);
  const [refreshing, setRefreshing] = useState(false);

  const winCacheRef = useRef<Map<string, WinData>>(new Map());
  const lastRefreshRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stateRef = useRef(state);

  const hideToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    dispatch({ type: "HIDE_TOAST" });
  }, []);

  const showToast = useCallback((message: string, isError = false, hideAfterMs = 0) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    dispatch({ type: "SHOW_TOAST", message, isError });
    if (hideAfterMs) toastTimerRef.current = setTimeout(hideToast, hideAfterMs);
  }, [hideToast]);

  const load = useCallback(
    async (rawUser: string) => {
      const u = rawUser.trim();
      setAddrInput(u);
      const cur = stateRef.current;
      const soft = !!cur.D;
      if (soft) {
        showToast(
          u.toLowerCase() === (cur.currentUser || "").toLowerCase()
            ? "Refreshing…"
            : `Loading ${u.slice(0, 6)}…${u.slice(-4)}`
        );
      }
      dispatch({ type: "LOAD_START", soft });
      try {
        if (!/^0x[a-fA-F0-9]{40}$/.test(u)) throw new Error("that doesn't look like an EVM address");
        const [portfolio, clearing, spot, spotCtx, vaults, staking] = await Promise.all([
          info<PortfolioEntry[]>({ type: "portfolio", user: u }),
          info<ClearinghouseState>({ type: "clearinghouseState", user: u }),
          safe(info<SpotClearinghouseState>({ type: "spotClearinghouseState", user: u })),
          safe(info<SpotCtx>({ type: "spotMetaAndAssetCtxs" })),
          safe(info<VaultEquity[]>({ type: "userVaultEquities", user: u })),
          safe(info<DelegatorSummary>({ type: "delegatorSummary", user: u })),
        ]);
        const newD: AppData = { pmap: Object.fromEntries(portfolio), clearing, spot, spotCtx, vaults, staking };
        winCacheRef.current.clear();
        const newPeriod: Period = cur.period === "custom" ? "month" : cur.period;
        const winData = await computeWinData(newD, u, newPeriod, null, winCacheRef.current);
        dispatch({ type: "LOAD_SUCCESS", D: newD, currentUser: u, winData, period: newPeriod, range: null });
        try {
          localStorage.setItem(ADDR_STORAGE_KEY, u);
        } catch {}
        lastRefreshRef.current = Date.now();
        hideToast();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: "LOAD_ERROR", soft, message });
        if (soft) showToast(`Refresh failed: ${message}`, true, 5000);
      }
    },
    [hideToast, showToast]
  );

  const loadRef = useRef(load);

  useEffect(() => {
    stateRef.current = state;
    loadRef.current = load;
  });

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(ADDR_STORAGE_KEY);
    } catch {}
    loadRef.current(saved || DEFAULT_ADDR);
  }, []);

  useEffect(() => {
    const maybeRefresh = () => {
      const cur = stateRef.current;
      if (cur.currentUser && cur.D && Date.now() - lastRefreshRef.current > STALE_MS) {
        loadRef.current(cur.currentUser);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeRefresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) maybeRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const setPeriod = useCallback(async (p: Period, targetRange: Range | null) => {
    const cur = stateRef.current;
    if (!cur.D || !cur.currentUser) return;
    dispatch({ type: "PERIOD_PENDING", period: p });
    try {
      const winData = await computeWinData(cur.D, cur.currentUser, p, targetRange, winCacheRef.current);
      dispatch({ type: "PERIOD_SUCCESS", period: p, range: targetRange, winData });
    } catch (err) {
      dispatch({ type: "PERIOD_ERROR" });
      const message = err instanceof Error ? err.message : String(err);
      alert("Window lookup failed: " + message);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load(addrInput);
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await load(state.currentUser || addrInput);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePeriodClick = (p: Period) => {
    setPeriod(p, state.range);
  };

  const handleApplyRange = () => {
    const s = Date.parse(state.rsVal);
    const en = Date.parse(state.reVal);
    if (isNaN(s) || isNaN(en) || s > en) {
      alert("Pick a valid start and end date first.");
      return;
    }
    setPeriod("custom", { start: s, end: en + 86399999 });
  };

  if (state.loading) {
    return (
      <>
        <Header addrInput={addrInput} onAddrChange={setAddrInput} onSubmit={handleSubmit} onRefresh={handleRefresh} refreshing={refreshing} />
        <div className="loading">Querying Hyperliquid…</div>
        <Toast {...state.toast} />
      </>
    );
  }

  if (state.error) {
    return (
      <>
        <Header addrInput={addrInput} onAddrChange={setAddrInput} onSubmit={handleSubmit} onRefresh={handleRefresh} refreshing={refreshing} />
        <div className="error">Couldn&apos;t load this account: {state.error}.</div>
        <Toast {...state.toast} />
      </>
    );
  }

  const D = state.D!;
  const custom = state.period === "custom" && !!state.range;
  const acct = accountBreakdown(D);
  const vol = +(D.pmap.allTime?.vlm || 0);
  const activeFills = state.winData?.fills || [];
  const activeFunding = state.winData?.funding || [];
  const activeLedger = state.winData?.ledger || [];
  const coins = byCoin(activeFills);
  const totR = coins.reduce((s, c) => s + c.realized, 0);
  const totF = coins.reduce((s, c) => s + c.fees, 0);
  const nTrades = coins.reduce((s, c) => s + c.trades, 0);
  const fundTot = activeFunding.reduce((s, f) => s + (+(f?.delta?.usdc || 0)), 0);
  const positions = (D.clearing?.assetPositions || []).map((p) => p.position).filter((p) => +p.szi !== 0);

  const flows = {
    dep: 0,
    depN: 0,
    wd: 0,
    wdN: 0,
    recent: [] as { t: number; kind: string; amt: number; fee?: number; to?: string }[],
  };
  for (const ev of activeLedger) {
    const f = flowOf(ev, state.currentUser);
    if (!f) continue;
    if (f.dir === "in") {
      flows.dep += f.amt;
      flows.depN++;
    } else {
      flows.wd += f.amt;
      flows.wdN++;
      flows.recent.push({ t: ev.time, kind: f.kind, amt: f.amt, fee: f.fee, to: f.to });
    }
  }
  flows.recent.sort((a, b) => b.t - a.t);

  const win = currentWin(D, state.period, state.range);
  const bk = buildBuckets(D, win, activeLedger, state.currentUser);
  const wLbl = winLabel(state.period, state.range);
  const series = seriesFor(D, state.period, state.range, state.metric);
  const periodValues: [string, string, number][] = PERIODS.map(([k, l]) => [k, l, periodPnl(D, k)]);

  return (
    <>
      <Header addrInput={addrInput} onAddrChange={setAddrInput} onSubmit={handleSubmit} onRefresh={handleRefresh} refreshing={refreshing} />
      <StatsStrip
        acct={acct}
        periodValues={periodValues}
        custom={custom}
        customLabel={wLbl}
        customValue={state.range ? rangePnl(D, state.range) : 0}
        vol={vol}
      />
      <ChartPanel
        metric={state.metric}
        period={state.period}
        wLbl={wLbl}
        rsVal={state.rsVal}
        reVal={state.reVal}
        pendingPeriod={state.pendingPeriod}
        series={series}
        onMetricChange={(m) => dispatch({ type: "SET_METRIC", metric: m })}
        onPeriodChange={handlePeriodClick}
        onRsChange={(v) => dispatch({ type: "SET_RS", value: v })}
        onReChange={(v) => dispatch({ type: "SET_RE", value: v })}
        onApplyRange={handleApplyRange}
      />
      <FlowsPanel buckets={bk.arr} daily={bk.daily} wLbl={wLbl} />
      <div className="cols">
        <MarketTable coins={coins} totR={totR} totF={totF} nTrades={nTrades} wLbl={wLbl} />
        <div className="side">
          <Positions positions={positions} />
          <FundingPanel fundTot={fundTot} fundingCount={activeFunding.length} wLbl={wLbl} />
          <CapitalFlows
            dep={flows.dep}
            depN={flows.depN}
            wd={flows.wd}
            wdN={flows.wdN}
            recent={flows.recent}
            wLbl={wLbl}
          />
        </div>
      </div>
      <footer>
        Live from the public Hyperliquid info API. Every chart and panel is scoped to the selected window ({wLbl}).
        Fills, funding and transfers are fetched per window and cached; the API caps fill history at the 10,000 most
        recent, so very deep all-time market attribution can be partial. Deposits and withdrawals don&apos;t count as
        profit — PnL is trading only.
      </footer>
      <Toast {...state.toast} />
    </>
  );
}

function Header({
  addrInput,
  onAddrChange,
  onSubmit,
  onRefresh,
  refreshing,
}: {
  addrInput: string;
  onAddrChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <header>
      <div>
        <div className="eyebrow">HYPERLIQUID &middot; PERPS ACCOUNT</div>
        <h1>Profit ledger</h1>
      </div>
      <form onSubmit={onSubmit}>
        <input
          spellCheck={false}
          aria-label="Wallet address"
          value={addrInput}
          onChange={(e) => onAddrChange(e.target.value)}
        />
        <button className="btn" type="submit">
          Load
        </button>
        <button
          className={`btn ghost ${refreshing ? "spin" : ""}`}
          type="button"
          aria-label="Refresh data"
          title="Refresh"
          disabled={refreshing}
          onClick={onRefresh}
        >
          &#x27F3;
        </button>
      </form>
    </header>
  );
}
