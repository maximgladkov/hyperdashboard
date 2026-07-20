"use client";

import { hlSocket } from "@/lib/hlws";
import { useSyncExternalStore } from "react";

const THROTTLE_MS = 500;

const EMPTY: Record<string, number> = {};

let published = EMPTY;
let latest = EMPTY;
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
const listeners = new Set<() => void>();

function flush(): void {
  flushTimer = null;
  if (!dirty) return;
  dirty = false;
  published = latest;
  listeners.forEach((l) => l());
}

function applyMids(mids: Record<string, number | string>, immediate: boolean): void {
  let changed = false;
  const next = { ...latest };
  for (const coin in mids) {
    const n = +mids[coin];
    if (n && next[coin] !== n) {
      next[coin] = n;
      changed = true;
    }
  }
  if (!changed) return;
  latest = next;
  dirty = true;
  if (immediate || published === EMPTY) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush();
    return;
  }
  if (!flushTimer) flushTimer = setTimeout(flush, THROTTLE_MS);
}

function handleMids(data: unknown): void {
  const mids = (data as { mids?: Record<string, string> })?.mids;
  if (!mids) return;
  applyMids(mids, false);
}

export function seedMarkPrices(mids: Record<string, number>): void {
  applyMids(mids, true);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    unsubscribe = hlSocket.subscribe({ type: "allMids" }, handleMids);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unsubscribe?.();
      unsubscribe = null;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      latest = EMPTY;
      published = EMPTY;
      dirty = false;
    }
  };
}

export function useMarkPrices(): Record<string, number> {
  return useSyncExternalStore(
    subscribe,
    () => published,
    () => EMPTY
  );
}

export function useMarkPrice(coin: string | null | undefined, fallback?: number | null): number | null {
  const mids = useMarkPrices();
  if (!coin) return fallback ?? null;
  const value = mids[coin];
  return value != null ? value : fallback ?? null;
}
