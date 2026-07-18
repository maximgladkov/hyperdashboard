import { removeSubscription } from "@/lib/push-store";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UnsubscribeBody = {
  address?: string;
  endpoint?: string;
};

export async function POST(request: NextRequest) {
  let body: UnsubscribeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const address = body.address?.trim().toLowerCase();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ error: "missing endpoint" }, { status: 400 });
  }

  try {
    await removeSubscription(address, body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
