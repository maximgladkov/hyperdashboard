export const usd = (v: unknown, sign = false): string => {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const s =
    a >= 1000
      ? a.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : a.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${n < 0 ? "\u2212" : sign && n > 0 ? "+" : ""}$${s}`;
};

export const cls = (v: unknown): "pos" | "neg" => (Number(v) >= 0 ? "pos" : "neg");

export const fdate = (ms: number): string =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
