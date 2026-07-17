import { getRedis } from "@/lib/redis";
import { type TrailType, validateConfig } from "@/lib/trail";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConfigBody = {
  address?: string;
  type?: unknown;
  value?: unknown;
  enabled?: unknown;
  effectiveType?: unknown;
  reset?: "all" | "type" | "value" | "enabled";
};

const RESET_FIELDS = new Set(["type", "value", "enabled"]);

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
      await redis.del(key);
      return NextResponse.json({ ok: true });
    }

    if (body.reset && RESET_FIELDS.has(body.reset)) {
      await redis.hdel(key, body.reset);
      return NextResponse.json({ ok: true });
    }

    const effectiveType: TrailType = body.effectiveType === "abs" ? "abs" : "pct";
    const { ok, errors } = validateConfig(
      { type: body.type, value: body.value, enabled: body.enabled },
      effectiveType
    );

    if (errors.length) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }
    if (!Object.keys(ok).length) {
      return NextResponse.json({ error: "no valid fields to write" }, { status: 400 });
    }

    const fields: Record<string, string> = {};
    if (ok.type !== undefined) fields.type = ok.type;
    if (ok.value !== undefined) fields.value = String(ok.value);
    if (ok.enabled !== undefined) fields.enabled = String(ok.enabled);

    await redis.hset(key, fields);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
