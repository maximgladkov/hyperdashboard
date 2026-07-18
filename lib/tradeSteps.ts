"use client";

import { useSyncExternalStore } from "react";

function createStepStore(storageKey: string, defaultValue: number) {
  let value = defaultValue;
  let hydrated = false;
  const listeners = new Set<() => void>();

  function hydrate(): void {
    if (hydrated) return;
    hydrated = true;
    try {
      const raw = localStorage.getItem(storageKey);
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) value = n;
    } catch { }
  }

  function get(): number {
    hydrate();
    return value;
  }

  function set(next: number): void {
    if (!Number.isFinite(next) || next <= 0) return;
    hydrate();
    if (next === value) return;
    value = next;
    try {
      localStorage.setItem(storageKey, String(next));
    } catch { }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function useStep(): [number, (next: number) => void] {
    const state = useSyncExternalStore(subscribe, get, () => defaultValue);
    return [state, set];
  }

  return { get, set, subscribe, useStep };
}

export const DEFAULT_PRICE_STEP = 50;
export const DEFAULT_POSITION_STEP = 0.001;

const priceStepStore = createStepStore("hd.priceStep", DEFAULT_PRICE_STEP);
const positionStepStore = createStepStore("hd.positionStep", DEFAULT_POSITION_STEP);

export const getPriceStep = priceStepStore.get;
export const setPriceStep = priceStepStore.set;
export const subscribePriceStep = priceStepStore.subscribe;
export const usePriceStep = priceStepStore.useStep;

export const getPositionStep = positionStepStore.get;
export const setPositionStep = positionStepStore.set;
export const subscribePositionStep = positionStepStore.subscribe;
export const usePositionStep = positionStepStore.useStep;
