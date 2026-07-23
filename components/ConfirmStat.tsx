"use client";

import { NumberValue } from "@heroui-pro/react";
import { Card } from "@heroui/react";
import type { ReactNode } from "react";

export function ConfirmStat({
  label,
  value,
  currency = true,
  suffix,
  tone,
}: {
  label: string;
  value: number | null;
  currency?: boolean;
  suffix?: string;
  tone?: "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <span className="text-sm text-muted">{label}</span>
      {value == null ? (
        <span className="font-mono text-sm text-muted">&mdash;</span>
      ) : (
        <NumberValue
          className={`text-xl items-baseline tabular-nums ${tone === "danger" ? "text-danger" : "text-foreground"}`}
          currency={currency ? "USD" : undefined}
          maximumFractionDigits={currency ? (Math.abs(value) >= 1000 ? 0 : 2) : 4}
          style={currency ? "currency" : "decimal"}
          value={value}
        >
          {suffix && (
            <NumberValue.Suffix className="ml-2 text-sm text-muted leading-none">
              {suffix}
            </NumberValue.Suffix>
          )}
        </NumberValue>
      )}
    </div>
  );
}

export function ConfirmStatsCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <Card variant="secondary" className="flex flex-col gap-0 p-0 divide-y">
        {children}
      </Card>
    </div>
  );
}
