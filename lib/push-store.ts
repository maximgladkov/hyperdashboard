import { getRedis } from "@/lib/redis";

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function subsKey(address: string): string {
  return `push:subs:${address}`;
}

export async function saveSubscription(address: string, subscription: PushSubscriptionJSON): Promise<void> {
  const redis = getRedis();
  await redis.hset(subsKey(address), subscription.endpoint, JSON.stringify(subscription));
}

export async function removeSubscription(address: string, endpoint: string): Promise<void> {
  const redis = getRedis();
  await redis.hdel(subsKey(address), endpoint);
}
