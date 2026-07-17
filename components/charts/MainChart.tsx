"use client";

import "@/lib/chartSetup";
import type { ChartData, ChartOptions, ScriptableContext } from "chart.js";
import { Line } from "react-chartjs-2";
import { fdate, usd } from "@/lib/format";
import type { Metric } from "@/lib/types";

const MINT = "#4FE3C1", EMBER = "#FF7A6B", GOLD = "#E5C97B", DIM = "#6E8B82", EDGE = "#16332C";

type Point = { t: number; v: number };

export default function MainChart({ series, metric }: { series: Point[]; metric: Metric }) {
  if (!series.length) return null;

  const vals = series.map((p) => p.v);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const off = max <= 0 ? 0 : min >= 0 ? 1 : max / (max - min);
  const clampOff = Math.min(Math.max(off, 0), 1);

  const data: ChartData<"line"> = {
    labels: series.map((p) => p.t),
    datasets: [
      {
        data: vals,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
        fill: metric === "pnl",
        borderColor:
          metric === "pnl"
            ? (context: ScriptableContext<"line">) => {
                const { ctx: cc, chartArea } = context.chart;
                if (!chartArea) return MINT;
                const g = cc.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                g.addColorStop(clampOff, MINT);
                g.addColorStop(clampOff, EMBER);
                return g;
              }
            : GOLD,
        backgroundColor: (context: ScriptableContext<"line">) => {
          const g = context.chart.ctx.createLinearGradient(0, 0, 0, 300);
          g.addColorStop(0, "rgba(79,227,193,.35)");
          g.addColorStop(clampOff, "rgba(79,227,193,.03)");
          g.addColorStop(clampOff, "rgba(255,122,107,.03)");
          g.addColorStop(1, "rgba(255,122,107,.35)");
          return g;
        },
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#081613",
        borderColor: EDGE,
        borderWidth: 1,
        titleFont: { family: "monospace" },
        bodyFont: { family: "monospace" },
        callbacks: {
          title: (items) => new Date(+items[0].label).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
          label: (i) => (metric === "pnl" ? "PnL " : "Equity ") + usd(i.parsed.y, metric === "pnl"),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: EDGE },
        ticks: {
          color: DIM,
          font: { family: "monospace", size: 11 },
          maxTicksLimit: 8,
          callback: (_v, i) => fdate(+series[i]?.t),
        },
      },
      y: {
        grid: { color: "rgba(22,51,44,.6)" },
        border: { color: EDGE },
        ticks: { color: DIM, font: { family: "monospace", size: 11 }, callback: (v) => usd(v) },
      },
    },
  };

  return <Line data={data} options={options} />;
}
