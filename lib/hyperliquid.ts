import type { Fill, FundingEvent, LedgerEvent, OpenOrder, PerpMeta, WinData } from "./types";

const API = "https://api.hyperliquid.xyz/info";

export async function info<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API ${r.status} on ${body.type}`);
  return r.json() as Promise<T>;
}

export async function fetchOpenOrders(u: string): Promise<OpenOrder[]> {
  try {
    return await info<OpenOrder[]>({ type: "frontendOpenOrders", user: u });
  } catch {
    return [];
  }
}

let perpMetaPromise: Promise<PerpMeta | null> | null = null;

function fetchPerpMeta(): Promise<PerpMeta | null> {
  if (!perpMetaPromise) {
    perpMetaPromise = info<PerpMeta>({ type: "meta" }).catch(() => null);
  }
  return perpMetaPromise;
}

export async function fetchMaxLeverage(coin: string): Promise<number | null> {
  const meta = await fetchPerpMeta();
  const asset = meta?.universe?.find((a) => a.name === coin);
  return asset?.maxLeverage ?? null;
}

export async function fetchLedger(u: string, start: number, end: number): Promise<LedgerEvent[]> {
  let out: LedgerEvent[] = [];
  let t = start;
  try {
    for (let i = 0; i < 20; i++) {
      const batch = await info<LedgerEvent[]>({ type: "userNonFundingLedgerUpdates", user: u, startTime: t, endTime: end });
      if (!batch.length) break;
      out = out.concat(batch);
      if (batch.length < 500) break;
      t = Math.max(...batch.map((x) => x.time)) + 1;
    }
  } catch {}
  return out;
}

async function fetchFills(u: string, start: number, end: number): Promise<Fill[]> {
  let fills: Fill[] = [];
  let t = start;
  for (let i = 0; i < 10; i++) {
    const batch = await info<Fill[]>({ type: "userFillsByTime", user: u, startTime: t, endTime: end });
    if (!batch.length) break;
    fills = fills.concat(batch);
    if (batch.length < 2000) break;
    t = Math.max(...batch.map((f) => f.time)) + 1;
  }
  return fills;
}

async function fetchFunding(u: string, start: number, end: number): Promise<FundingEvent[]> {
  let funding: FundingEvent[] = [];
  let t = start;
  try {
    for (let i = 0; i < 20; i++) {
      const batch = await info<FundingEvent[]>({ type: "userFunding", user: u, startTime: t, endTime: end });
      if (!batch.length) break;
      funding = funding.concat(batch);
      if (batch.length < 500) break;
      t = Math.max(...batch.map((f) => f.time)) + 1;
    }
  } catch {}
  return funding;
}

export async function fetchRange(u: string, start: number, end: number): Promise<WinData> {
  const [fills, funding, ledger] = await Promise.all([
    fetchFills(u, start, end),
    fetchFunding(u, start, end),
    fetchLedger(u, start, end),
  ]);
  return { fills, funding, ledger };
}

export async function fetchPerpMids(): Promise<Record<string, number>> {
  const [meta, ctxs] = await info<[PerpMeta, { midPx?: string; markPx?: string }[]]>({
    type: "metaAndAssetCtxs",
  });
  const mids: Record<string, number> = {};
  const universe = meta.universe || [];
  for (let i = 0; i < universe.length; i++) {
    const px = +(ctxs[i]?.markPx || ctxs[i]?.midPx || 0);
    if (px) mids[universe[i].name] = px;
  }
  return mids;
}
