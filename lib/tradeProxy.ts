const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export type OrderResult = {
  status: "filled" | "resting";
  oid: number;
  filledSz: number;
  avgPx?: number;
};

export type OrderInput = {
  side: "buy" | "sell";
  size: number;
  price?: number | null;
  reduceOnly?: boolean;
};

export function normalizeAddress(raw: unknown): string | null {
  const address = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return ADDRESS_RE.test(address) ? address : null;
}

function baseUrl(): string {
  const url = process.env.TRADING_API_BASE_URL;
  if (!url) throw new Error("TRADING_API_BASE_URL is not set");
  return url.replace(/\/+$/, "");
}

export async function forwardTrade(
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const token = process.env.TRADING_API_TOKEN;
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
  return { status: res.status, data };
}
