import { getRedis } from "@/lib/redis";
import { validateTunnelConfig } from "@/lib/trail";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConfigBody = {
  address?: string;
  enabled?: unknown;
  low?: unknown;
  high?: unknown;
  size?: unknown;
  reset?: "all" | "enabled" | "low" | "high" | "size";
};

const RESET_FIELDS = new Set(["enabled", "low", "high", "size"]);

const FIELD_MAP: Record<string, string> = {
  enabled: "tunnelEnabled",
  low: "tunnelLow",
  high: "tunnelHigh",
  size: "tunnelSize",
};

async function clearTunnelBaseline(redis: ReturnType<typeof getRedis>, address: string): Promise<void> {
  await redis.del(`bot:tunnel:${address}`);
}

export async function POST(request: NextRequest) {
  let body: ConfigBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const address = body.address?.trim().toLowerCase();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const redis = getRedis();
  const key = `bot:config:${address}`;

  try {
    if (body.reset === "all") {
      await redis.hdel(key, "tunnelEnabled", "tunnelLow", "tunnelHigh", "tunnelSize");
      await clearTunnelBaseline(redis, address);
      return NextResponse.json({ ok: true });
    }

    if (body.reset && RESET_FIELDS.has(body.reset)) {
      await redis.hdel(key, FIELD_MAP[body.reset]!);
      if (body.reset === "enabled") {
        await clearTunnelBaseline(redis, address);
      }
      return NextResponse.json({ ok: true });
    }

    const { ok, errors } = validateTunnelConfig({
      enabled: body.enabled,
      low: body.low,
      high: body.high,
      size: body.size,
    });

    if (errors.length) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }
    if (!Object.keys(ok).length) {
      return NextResponse.json({ error: "no valid fields to write" }, { status: 400 });
    }

    const fields: Record<string, string> = {};
    if (ok.enabled !== undefined) fields.tunnelEnabled = String(ok.enabled);
    if (ok.low !== undefined) fields.tunnelLow = String(ok.low);
    if (ok.high !== undefined) fields.tunnelHigh = String(ok.high);
    if (ok.size !== undefined) fields.tunnelSize = String(ok.size);

    await redis.hset(key, fields);
    if (ok.enabled !== undefined) {
      await clearTunnelBaseline(redis, address);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
