import { Format } from "@number-flow/react";

export const usd = (v: unknown, sign = false): string => {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const s =
    a >= 1000
      ? a.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : a.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${n < 0 ? "\u2212" : sign && n > 0 ? "+" : ""}$${s}`;
};

export const cls = (v: unknown): "text-success" | "text-danger" =>
  Number(v) >= 0 ? "text-success" : "text-danger";

export const fdate = (ms: number): string =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });

export const moneyFormatOptions = (
  v: unknown,
  sign = false
): Format => {
  const n = Number(v) || 0;
  return {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
    signDisplay: sign ? "exceptZero" : "auto",
  };
};
