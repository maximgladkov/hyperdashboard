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

export type CloseResult = {
  ok: true;
  closed: boolean;
  reason?: string;
  order?: OrderResult;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function placeOrder(address: string, input: OrderInput) {
  return post<{ ok: true; order: OrderResult }>("/api/trade/order", { address, ...input });
}

export function closePosition(address: string) {
  return post<CloseResult>("/api/trade/close", { address });
}

export type CancelResult = {
  ok: true;
  cancelled: boolean;
  oid: number;
};

export function cancelOrder(address: string, oid: number) {
  return post<CancelResult>("/api/trade/cancel", { address, oid });
}
