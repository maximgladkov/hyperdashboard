"use client";

import "@/lib/chartSetup";
import { Chart } from "chart.js";
import type { ChartData, ChartOptions } from "chart.js";
import { Bar } from "react-chartjs-2";
import { usd } from "@/lib/format";
import type { Bucket } from "@/lib/types";

const MINT = "#4FE3C1", GOLD = "#E5C97B", DIM = "#6E8B82", EDGE = "#16332C";
const SKY = "#7CC4FF";

export default function FlowsChart({ buckets }: { buckets: Bucket[] }) {
  if (buckets.length <= 1) return null;

  const data: ChartData<"bar"> = {
    labels: buckets.map((b) => b.label),
    datasets: [
      {
        label: "PnL",
        data: buckets.map((b) => b.pnl),
        borderRadius: 3,
        backgroundColor: buckets.map((b) => (b.pnl >= 0 ? "rgba(79,227,193,.85)" : "rgba(255,122,107,.85)")),
      },
      {
        label: "Deposits",
        data: buckets.map((b) => b.dep),
        borderRadius: 3,
        backgroundColor: "rgba(124,196,255,.7)",
      },
      {
        label: "Withdrawals",
        data: buckets.map((b) => -b.wd),
        borderRadius: 3,
        backgroundColor: "rgba(229,201,123,.7)",
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: DIM,
          boxWidth: 10,
          boxHeight: 10,
          font: { family: "monospace", size: 11 },
          generateLabels: (chart) => {
            const l = Chart.defaults.plugins.legend.labels.generateLabels(chart);
            l[0].fillStyle = MINT;
            l[1].fillStyle = SKY;
            l[2].fillStyle = GOLD;
            l.forEach((x) => (x.strokeStyle = "transparent"));
            return l;
          },
        },
      },
      tooltip: {
        backgroundColor: "#081613",
        borderColor: EDGE,
        borderWidth: 1,
        bodyFont: { family: "monospace" },
        titleFont: { family: "monospace" },
        callbacks: { label: (i) => `${i.dataset.label} ${usd(i.parsed.y, i.dataset.label === "PnL")}` },
      },
    },
    scales: {
      x: {
        stacked: false,
        grid: { display: false },
        border: { color: EDGE },
        ticks: { color: DIM, font: { family: "monospace", size: 11 }, maxTicksLimit: 16 },
      },
      y: {
        grid: { color: "rgba(22,51,44,.6)" },
        border: { color: EDGE },
        ticks: { color: DIM, font: { family: "monospace", size: 11 }, callback: (v) => usd(v) },
      },
    },
  };

  return <Bar data={data} options={options} />;
}
