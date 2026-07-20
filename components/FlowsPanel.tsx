import FlowsChart from "@/components/charts/FlowsChart";
import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";
import type { Bucket } from "@/lib/types";
import { Widget } from "@heroui-pro/react";

export default function FlowsPanel({ buckets, wLbl }: { buckets: Bucket[]; daily: boolean; wLbl: string }) {
  if (buckets.length <= 1) return null;
  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Profit &amp; capital flows</Widget.Title>
        <Widget.Description>{wLbl}</Widget.Description>
      </Widget.Header>
      <Widget.Content>
        <WidgetErrorBoundary label="Flows">
          <FlowsChart buckets={buckets} />
        </WidgetErrorBoundary>
      </Widget.Content>
    </Widget>
  );
}
