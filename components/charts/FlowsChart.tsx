"use client";

import { Cell } from "recharts";
import { BarChart, ChartTooltip } from "@heroui-pro/react";
import { usd } from "@/lib/format";
import type { Bucket } from "@/lib/types";

export default function FlowsChart({ buckets }: { buckets: Bucket[] }) {
  if (buckets.length <= 1) return null;

  const data = buckets.map((b) => ({ label: b.label, pnl: b.pnl, dep: b.dep, wd: -b.wd }));

  return (
    <BarChart data={data} height={230} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
      <BarChart.Grid vertical={false} />
      <BarChart.XAxis dataKey="label" interval="preserveStartEnd" tickMargin={8} />
      <BarChart.YAxis tickFormatter={(v: number) => usd(v)} width={72} />
      <BarChart.Bar dataKey="pnl" name="PnL" radius={[3, 3, 3, 3]}>
        {data.map((d, i) => (
          <Cell key={i} fill={d.pnl >= 0 ? "var(--color-success)" : "var(--color-danger)"} />
        ))}
      </BarChart.Bar>
      <BarChart.Bar dataKey="dep" fill="var(--chart-2)" name="Deposits" radius={[3, 3, 3, 3]} />
      <BarChart.Bar dataKey="wd" fill="var(--chart-4)" name="Withdrawals" radius={[3, 3, 3, 3]} />
      <BarChart.Tooltip
        content={({ active, label, payload }) => {
          if (!active || !payload?.length) return null;
          const entries = payload.filter((entry) => Number(entry.value) !== 0);
          if (!entries.length) return null;
          return (
            <ChartTooltip>
              <ChartTooltip.Header>{label}</ChartTooltip.Header>
              {entries.map((entry) => {
                const isPnl = entry.dataKey === "pnl";
                const value = Number(entry.value);
                return (
                  <ChartTooltip.Item key={String(entry.dataKey)}>
                    <ChartTooltip.Indicator
                      color={isPnl ? (value >= 0 ? "var(--color-success)" : "var(--color-danger)") : entry.fill}
                    />
                    <ChartTooltip.Label>{entry.name}</ChartTooltip.Label>
                    <ChartTooltip.Value>{usd(value, isPnl)}</ChartTooltip.Value>
                  </ChartTooltip.Item>
                );
              })}
            </ChartTooltip>
          );
        }}
      />
    </BarChart>
  );
}
