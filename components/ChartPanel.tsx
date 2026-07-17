import MainChart from "@/components/charts/MainChart";
import { PERIODS } from "@/lib/compute";
import type { Metric, Period } from "@/lib/types";

type Point = { t: number; v: number };

export default function ChartPanel({
  metric,
  period,
  wLbl,
  rsVal,
  reVal,
  pendingPeriod,
  series,
  onMetricChange,
  onPeriodChange,
  onRsChange,
  onReChange,
  onApplyRange,
}: {
  metric: Metric;
  period: Period;
  wLbl: string;
  rsVal: string;
  reVal: string;
  pendingPeriod: Period | null;
  series: Point[];
  onMetricChange: (m: Metric) => void;
  onPeriodChange: (p: Period) => void;
  onRsChange: (v: string) => void;
  onReChange: (v: string) => void;
  onApplyRange: () => void;
}) {
  return (
    <section className="panel">
      <div className="phead">
        <div className="ptitle">
          {metric === "pnl" ? "Cumulative PnL" : "Account value"}
          <span className="psub"> &middot; {wLbl}</span>
        </div>
        <div className="toggles">
          <div className="tgroup">
            <button
              className={`tgl ${metric === "pnl" ? "on" : ""}`}
              onClick={() => onMetricChange("pnl")}
            >
              PnL
            </button>
            <button
              className={`tgl ${metric === "equity" ? "on" : ""}`}
              onClick={() => onMetricChange("equity")}
            >
              Equity
            </button>
          </div>
          <div className="tgroup">
            {PERIODS.map(([k, l]) => (
              <button
                key={k}
                className={`tgl ${period === k ? "on" : ""}`}
                disabled={pendingPeriod === k}
                onClick={() => onPeriodChange(k)}
              >
                {pendingPeriod === k ? "\u2026" : l}
              </button>
            ))}
          </div>
          <div className="tgroup">
            <input
              type="date"
              className="dinput"
              aria-label="Range start"
              value={rsVal}
              onChange={(e) => onRsChange(e.target.value)}
            />
            <input
              type="date"
              className="dinput"
              aria-label="Range end"
              value={reVal}
              onChange={(e) => onReChange(e.target.value)}
            />
            <button
              className={`tgl ${period === "custom" ? "on" : ""}`}
              disabled={pendingPeriod === "custom"}
              onClick={onApplyRange}
            >
              {pendingPeriod === "custom" ? "\u2026" : "Range"}
            </button>
          </div>
        </div>
      </div>
      <div className="chartbox">
        <MainChart series={series} metric={metric} />
      </div>
    </section>
  );
}
