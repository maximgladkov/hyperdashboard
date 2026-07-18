import { forwardTrade, normalizeAddress } from "@/lib/tradeProxy";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { address?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const address = normalizeAddress(body.address);
  if (!address) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  try {
    const { status, data } = await forwardTrade(`/api/tenants/${address}/close`);
    return NextResponse.json(data, { status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
