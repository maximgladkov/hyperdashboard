"use client";

import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";
import { cls, moneyFormatOptions } from "@/lib/format";
import type { PositionRecord } from "@/lib/types";
import type { DataGridColumn, DataGridSortDescriptor } from "@heroui-pro/react";
import { DataGrid, EmptyState, Widget } from "@heroui-pro/react";
import { Chip, Spinner } from "@heroui/react";
import NumberFlow from "@number-flow/react";
import { useEffect, useMemo, useState } from "react";

const PAGE = 25;

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

function formatClosed(ms: number | null, status: PositionRecord["status"]): string {
  if (ms == null) return "Open";
  const label = new Date(ms).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return status === "partial" ? `${label} · partial` : label;
}

function formatSize(size: number): string {
  if (size >= 100) return size.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (size >= 1) return size.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return size.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function formatPx(px: number | null): string {
  if (px == null) return "\u2014";
  return px.toLocaleString("en-US", { maximumFractionDigits: px >= 1000 ? 1 : 4 });
}

const columns: DataGridColumn<PositionRecord>[] = [
  {
    id: "coin",
    header: "Market",
    accessorKey: "coin",
    isRowHeader: true,
    allowsSorting: true,
    pinned: "start",
    minWidth: 140,
    cell: (item) => (
      <span className="inline-flex items-center gap-1.5">
        <span className="font-semibold text-foreground">{item.coin}</span>
        <Chip color={item.side === "long" ? "success" : "danger"} size="sm">
          {item.side === "long" ? "Long" : "Short"}
        </Chip>
      </span>
    ),
  },
  {
    id: "closedAt",
    header: "Closed",
    accessorKey: "closedAt",
    allowsSorting: true,
    minWidth: 150,
    cell: (item) => (
      <span className="text-muted">{formatClosed(item.closedAt, item.status)}</span>
    ),
  },
  {
    id: "size",
    header: "Amount",
    accessorKey: "size",
    allowsSorting: true,
    align: "end",
    minWidth: 120,
    cell: (item) => (
      <span className="flex flex-col items-end leading-tight">
        <span className="text-foreground">{formatSize(item.size)}</span>
        <span className="text-xs text-muted">${formatSize(item.notional)}</span>
      </span>
    ),
  },
  {
    id: "avgEntry",
    header: "Entry",
    accessorKey: "avgEntry",
    allowsSorting: true,
    align: "end",
    minWidth: 100,
    cell: (item) => <span className="text-foreground">{formatPx(item.avgEntry)}</span>,
  },
  {
    id: "avgClose",
    header: "Close",
    accessorKey: "avgClose",
    allowsSorting: true,
    align: "end",
    minWidth: 100,
    cell: (item) => <span className="text-muted">{formatPx(item.avgClose)}</span>,
  },
  {
    id: "realized",
    header: "Realized",
    accessorKey: "realized",
    allowsSorting: true,
    align: "end",
    minWidth: 110,
    cell: (item) => (
      <span className={cls(item.realized)}>
        <NumberFlow format={moneyFormatOptions(item.realized, true)} value={item.realized} />
      </span>
    ),
  },
  {
    id: "fees",
    header: "Fees",
    accessorKey: "fees",
    allowsSorting: true,
    align: "end",
    minWidth: 90,
    cell: (item) => (
      <span className="text-muted">
        <NumberFlow format={moneyFormatOptions(-item.fees)} value={-item.fees} />
      </span>
    ),
  },
  {
    id: "funding",
    header: "Funding",
    accessorKey: "funding",
    allowsSorting: true,
    align: "end",
    minWidth: 90,
    cell: (item) => (
      <span className={item.funding ? cls(item.funding) : "text-muted"}>
        <NumberFlow format={moneyFormatOptions(item.funding, true)} value={item.funding} />
      </span>
    ),
  },
  {
    id: "net",
    header: "Net",
    accessorKey: "net",
    allowsSorting: true,
    align: "end",
    minWidth: 110,
    cell: (item) => (
      <span className={`font-semibold ${cls(item.net)}`}>
        <NumberFlow format={moneyFormatOptions(item.net, true)} value={item.net} />
      </span>
    ),
  },
  {
    id: "roi",
    header: "Return",
    accessorKey: "roi",
    allowsSorting: true,
    align: "end",
    minWidth: 80,
    cell: (item) => (
      <span className={cls(item.roi)}>
        <NumberFlow
          format={{ style: "percent", maximumFractionDigits: 2, signDisplay: "exceptZero" }}
          value={item.roi}
        />
      </span>
    ),
  },
  {
    id: "openedAt",
    header: "Duration",
    allowsSorting: true,
    align: "end",
    minWidth: 90,
    sortFn: (a, b) => {
      const da = (a.closedAt ?? Date.now()) - a.openedAt;
      const db = (b.closedAt ?? Date.now()) - b.openedAt;
      return da - db;
    },
    cell: (item) => (
      <span className="text-muted">
        {formatDuration((item.closedAt ?? Date.now()) - item.openedAt)}
      </span>
    ),
  },
  {
    id: "fills",
    header: "Fills",
    accessorKey: "fills",
    allowsSorting: true,
    align: "end",
    minWidth: 70,
    cell: (item) => (
      <span className="text-muted">
        <NumberFlow value={item.fills} />
      </span>
    ),
  },
];

export default function PositionHistory({
  rows,
  wLbl,
}: {
  rows: PositionRecord[];
  wLbl: string;
}) {
  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Position history</Widget.Title>
        <Widget.Description>{wLbl}</Widget.Description>
      </Widget.Header>
      <Widget.Content className={rows.length ? "p-0" : undefined}>
        <WidgetErrorBoundary label="Position history">
          <PositionHistoryBody rows={rows} wLbl={wLbl} />
        </WidgetErrorBoundary>
      </Widget.Content>
    </Widget>
  );
}

function PositionHistoryBody({ rows, wLbl }: { rows: PositionRecord[]; wLbl: string }) {
  const [visible, setVisible] = useState(PAGE);
  const [sortDescriptor, setSortDescriptor] = useState<DataGridSortDescriptor>({
    column: "closedAt",
    direction: "descending",
  });

  useEffect(() => {
    setVisible(PAGE);
  }, [wLbl, rows.length]);

  const sorted = useMemo(() => {
    const col = String(sortDescriptor.column);
    const dir = sortDescriptor.direction === "ascending" ? 1 : -1;
    const column = columns.find((c) => c.id === col);
    return [...rows].sort((a, b) => {
      if (column?.sortFn) return column.sortFn(a, b) * dir;
      const av = a[col as keyof PositionRecord];
      const bv = b[col as keyof PositionRecord];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sortDescriptor]);

  if (!rows.length) {
    return (
      <EmptyState size="sm">
        <EmptyState.Header>
          <EmptyState.Title>No positions</EmptyState.Title>
          <EmptyState.Description>
            No closed or open round-trips in this window.
          </EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    );
  }

  const hasMore = visible < sorted.length;

  return (
    <DataGrid
      aria-label="Position history"
      columns={columns}
      contentClassName="min-w-[1100px] font-mono text-sm"
      data={sorted.slice(0, visible)}
      getRowId={(item) => item.id}
      isLoadingMore={false}
      loadMoreContent={hasMore ? <Spinner size="sm" /> : null}
      scrollContainerClassName="max-h-[520px] overflow-y-auto"
      sortDescriptor={sortDescriptor}
      variant="secondary"
      onLoadMore={hasMore ? () => setVisible((v) => Math.min(v + PAGE, sorted.length)) : undefined}
      onSortChange={setSortDescriptor}
    />
  );
}
