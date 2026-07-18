import type { Fill, FundingEvent, LedgerEvent, OpenOrder, WinData } from "./types";

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

export async function fetchRange(u: string, start: number, end: number): Promise<WinData> {
  let fills: Fill[] = [];
  let t = start;
  for (let i = 0; i < 10; i++) {
    const batch = await info<Fill[]>({ type: "userFillsByTime", user: u, startTime: t, endTime: end });
    if (!batch.length) break;
    fills = fills.concat(batch);
    if (batch.length < 2000) break;
    t = Math.max(...batch.map((f) => f.time)) + 1;
  }
  let funding: FundingEvent[] = [];
  let ft = start;
  try {
    for (let i = 0; i < 20; i++) {
      const batch = await info<FundingEvent[]>({ type: "userFunding", user: u, startTime: ft, endTime: end });
      if (!batch.length) break;
      funding = funding.concat(batch);
      if (batch.length < 500) break;
      ft = Math.max(...batch.map((f) => f.time)) + 1;
    }
  } catch {}
  const ledger = await fetchLedger(u, start, end);
  return { fills, funding, ledger };
}
