"use client";

import { fetchUserFees } from "@/lib/hyperliquid";
import { useEffect, useState } from "react";

export const BASE_CROSS_RATE = 0.00045;
export const BASE_ADD_RATE = 0.00015;

export type FeeRates = {
  crossRate: number;
  addRate: number;
};

export const BASE_FEE_RATES: FeeRates = {
  crossRate: BASE_CROSS_RATE,
  addRate: BASE_ADD_RATE,
};

export function isTaker(
  side: "buy" | "sell",
  price: number | null,
  mark: number | null
): boolean {
  if (price == null || mark == null) return true;
  return side === "buy" ? price >= mark : price <= mark;
}

export function estimateFee({
  notional,
  taker,
  rates,
}: {
  notional: number;
  taker: boolean;
  rates: FeeRates;
}): number {
  return notional * (taker ? rates.crossRate : rates.addRate);
}

export function useUserFees(address?: string): FeeRates {
  const [rates, setRates] = useState<FeeRates>(BASE_FEE_RATES);

  useEffect(() => {
    if (!address) {
      setRates(BASE_FEE_RATES);
      return;
    }
    let cancelled = false;
    fetchUserFees(address).then((next) => {
      if (!cancelled) setRates(next);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return rates;
}
