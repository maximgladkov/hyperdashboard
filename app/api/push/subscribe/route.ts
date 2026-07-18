import { saveSubscription, type PushSubscriptionJSON } from "@/lib/push-store";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscribeBody = {
  address?: string;
  subscription?: PushSubscriptionJSON;
};

export async function POST(request: NextRequest) {
  let body: SubscribeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const address = body.address?.trim().toLowerCase();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const subscription = body.subscription;
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  try {
    await saveSubscription(address, subscription);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
