"use client";

import { useId } from "react";
import { AreaChart, ChartTooltip } from "@heroui-pro/react";
import { fdate, usd } from "@/lib/format";
import type { Metric } from "@/lib/types";

type Point = { t: number; v: number };

export default function MainChart({ series, metric }: { series: Point[]; metric: Metric }) {
  const uid = useId();

  if (!series.length) return null;

  const vals = series.map((p) => p.v);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const off = max <= 0 ? 0 : min >= 0 ? 1 : max / (max - min);
  const clampOff = Math.min(Math.max(off, 0), 1);
  const strokeId = `${uid}-stroke`;
  const fillId = `${uid}-fill`;

  return (
    <AreaChart data={series} height={300} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
      <defs>
        {metric === "pnl" ? (
          <>
            <linearGradient id={strokeId} x1="0" x2="0" y1="0" y2="1">
              <stop offset={clampOff} stopColor="var(--color-success)" />
              <stop offset={clampOff} stopColor="var(--color-danger)" />
            </linearGradient>
            <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.35} />
              <stop offset={clampOff} stopColor="var(--color-success)" stopOpacity={0.03} />
              <stop offset={clampOff} stopColor="var(--color-danger)" stopOpacity={0.03} />
              <stop offset="100%" stopColor="var(--color-danger)" stopOpacity={0.35} />
            </linearGradient>
          </>
        ) : (
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.03} />
          </linearGradient>
        )}
      </defs>
      <AreaChart.Grid vertical={false} />
      <AreaChart.XAxis dataKey="t" tickFormatter={(v: number) => fdate(v)} tickMargin={8} />
      <AreaChart.YAxis tickFormatter={(v: number) => usd(v)} width={72} />
      <AreaChart.Area
        dataKey="v"
        dot={false}
        fill={`url(#${fillId})`}
        stroke={metric === "pnl" ? `url(#${strokeId})` : "var(--accent)"}
        strokeWidth={2}
        type="monotone"
      />
      <AreaChart.Tooltip
        content={({ active, label, payload }) => {
          if (!active || !payload?.length) return null;
          const v = Number(payload[0]?.value ?? 0);
          const color = metric === "pnl" ? (v >= 0 ? "var(--color-success)" : "var(--color-danger)") : "var(--accent)";
          return (
            <ChartTooltip>
              <ChartTooltip.Header>
                {new Date(Number(label)).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </ChartTooltip.Header>
              <ChartTooltip.Item>
                <ChartTooltip.Indicator color={color} />
                <ChartTooltip.Label>{metric === "pnl" ? "PnL" : "Equity"}</ChartTooltip.Label>
                <ChartTooltip.Value>{usd(v, metric === "pnl")}</ChartTooltip.Value>
              </ChartTooltip.Item>
            </ChartTooltip>
          );
        }}
      />
    </AreaChart>
  );
}
