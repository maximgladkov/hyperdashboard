export type Period = "day" | "week" | "month" | "allTime" | "custom";
export type Metric = "pnl" | "equity";

export type Range = { start: number; end: number };

export type HistoryPoint = [string | number, string | number];

export type PortfolioPeriodData = {
  pnlHistory?: HistoryPoint[];
  accountValueHistory?: HistoryPoint[];
  vlm?: string;
};

export type PortfolioMap = Record<string, PortfolioPeriodData>;

export type Position = {
  coin: string;
  szi: string;
  entryPx: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  leverage?: { value?: number };
};

export type AssetPosition = { position: Position };

export type ClearinghouseState = {
  marginSummary?: { accountValue?: string };
  assetPositions?: AssetPosition[];
};

export type SpotBalance = { coin: string; total: string };

export type SpotClearinghouseState = { balances?: SpotBalance[] };

export type SpotMetaToken = { name: string };
export type SpotMetaUniversePair = { tokens: [number, number] };
export type SpotMeta = { tokens?: SpotMetaToken[]; universe?: SpotMetaUniversePair[] };
export type SpotAssetCtx = { midPx?: string };
export type SpotCtx = [SpotMeta, SpotAssetCtx[]];

export type VaultEquity = { equity: string };

export type DelegatorSummary = {
  delegated?: string;
  undelegated?: string;
  totalPendingWithdrawal?: string;
};

export type Fill = {
  coin: string;
  closedPnl?: string;
  fee?: string;
  time: number;
};

export type FundingEvent = {
  time: number;
  delta?: { usdc?: string };
};

export type LedgerDelta = {
  type?: string;
  usdc?: string;
  usdcValue?: string;
  amount?: string;
  fee?: string;
  destination?: string;
  user?: string;
};

export type LedgerEvent = {
  time: number;
  delta?: LedgerDelta;
};

export type AppData = {
  pmap: PortfolioMap;
  clearing: ClearinghouseState;
  spot: SpotClearinghouseState | null;
  spotCtx: SpotCtx | null;
  vaults: VaultEquity[] | null;
  staking: DelegatorSummary | null;
};

export type WinData = {
  fills: Fill[];
  funding: FundingEvent[];
  ledger: LedgerEvent[];
};

export type CapitalFlow = {
  dir: "in" | "out";
  kind: string;
  amt: number;
  fee?: number;
  to?: string;
};

export type CoinAgg = {
  coin: string;
  realized: number;
  fees: number;
  trades: number;
  wins: number;
  closes: number;
  net: number;
};

export type Bucket = {
  k: string;
  t: number;
  lastPnl: number | null;
  dep: number;
  wd: number;
  pnl: number;
  label: string;
};
