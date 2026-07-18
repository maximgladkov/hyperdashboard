import { forwardTrade, normalizeAddress, type OrderInput } from "@/lib/tradeProxy";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderBody = {
  address?: string;
  side?: unknown;
  size?: unknown;
  price?: unknown;
  reduceOnly?: unknown;
};

export async function POST(request: NextRequest) {
  let body: OrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const address = normalizeAddress(body.address);
  if (!address) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  if (body.side !== "buy" && body.side !== "sell") {
    return NextResponse.json({ error: 'side must be "buy" or "sell"' }, { status: 400 });
  }

  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "size must be a positive number" }, { status: 400 });
  }

  const order: OrderInput = { side: body.side, size };

  if (body.price !== undefined && body.price !== null && body.price !== "") {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "price must be a positive number" }, { status: 400 });
    }
    order.price = price;
  }

  if (typeof body.reduceOnly === "boolean") {
    order.reduceOnly = body.reduceOnly;
  }

  try {
    const { status, data } = await forwardTrade(`/api/tenants/${address}/order`, order);
    return NextResponse.json(data, { status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
