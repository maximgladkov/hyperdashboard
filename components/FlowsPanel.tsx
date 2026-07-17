import FlowsChart from "@/components/charts/FlowsChart";
import type { Bucket } from "@/lib/types";

export default function FlowsPanel({ buckets, daily, wLbl }: { buckets: Bucket[]; daily: boolean; wLbl: string }) {
  if (buckets.length <= 1) return null;
  return (
    <section className="panel">
      <div className="ptitle">
        Profit &amp; capital flows
        <span className="psub"> &middot; {wLbl} &middot; by {daily ? "day" : "month"}</span>
      </div>
      <div className="chartbox" style={{ height: 230, marginTop: 12 }}>
        <FlowsChart buckets={buckets} />
      </div>
    </section>
  );
}
