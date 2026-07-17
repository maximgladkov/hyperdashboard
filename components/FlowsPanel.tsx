import { Widget } from "@heroui-pro/react";
import FlowsChart from "@/components/charts/FlowsChart";
import type { Bucket } from "@/lib/types";

export default function FlowsPanel({ buckets, daily, wLbl }: { buckets: Bucket[]; daily: boolean; wLbl: string }) {
  if (buckets.length <= 1) return null;
  return (
    <Widget className="mb-4">
      <Widget.Header className="flex-wrap gap-3">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <Widget.Title>Profit &amp; capital flows</Widget.Title>
          <Widget.Description>
            {wLbl} &middot; by {daily ? "day" : "month"}
          </Widget.Description>
        </div>
        <Widget.Legend>
          <Widget.LegendItem color="var(--color-success)">PnL</Widget.LegendItem>
          <Widget.LegendItem color="var(--chart-2)">Deposits</Widget.LegendItem>
          <Widget.LegendItem color="var(--chart-4)">Withdrawals</Widget.LegendItem>
        </Widget.Legend>
      </Widget.Header>
      <Widget.Content>
        <FlowsChart buckets={buckets} />
      </Widget.Content>
    </Widget>
  );
}
