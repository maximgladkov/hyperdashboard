import { getRedis } from "@/lib/redis";
import type { TenantState } from "@/lib/trail";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  try {
    const redis = getRedis();
    const isTenant = await redis.sismember("bot:tenants", address);
    if (!isTenant) {
      return NextResponse.json({ managed: false as const });
    }

    const raw = await redis.get(`bot:state:${address}`);
    if (!raw) {
      return NextResponse.json({ managed: true as const, state: null });
    }

    const state = JSON.parse(raw) as TenantState;
    return NextResponse.json({ managed: true as const, state });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
