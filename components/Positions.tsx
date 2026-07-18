"use client";

import { Chip } from "@heroui/react";
import { EmptyState, Widget } from "@heroui-pro/react";
import NumberFlow from "@number-flow/react";
import { useEffect, useRef, useState } from "react";
import { livePnl } from "@/lib/compute";
import { cls, moneyFormatOptions } from "@/lib/format";
import { hlSocket } from "@/lib/hlws";
import type { Position } from "@/lib/types";

const MIDS_THROTTLE_MS = 1000;

export default function Positions({ positions }: { positions: Position[] }) {
  const [mids, setMids] = useState<Record<string, number>>({});
  const midsRef = useRef<Record<string, number>>({});
  const flushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coins = positions.map((p) => p.coin).join(",");

  useEffect(() => {
    const wanted = coins.split(",").filter(Boolean);
    if (!wanted.length) return;
    const off = hlSocket.subscribe({ type: "allMids" }, (data) => {
      const incoming = (data as { mids?: Record<string, string> })?.mids;
      if (!incoming) return;
      let changed = false;
      for (const coin of wanted) {
        const raw = incoming[coin];
        if (raw == null) continue;
        const n = +raw;
        if (n && midsRef.current[coin] !== n) {
          midsRef.current[coin] = n;
          changed = true;
        }
      }
      if (changed && !flushRef.current) {
        flushRef.current = setTimeout(() => {
          flushRef.current = null;
          setMids({ ...midsRef.current });
        }, MIDS_THROTTLE_MS);
      }
    });
    return () => {
      off();
      if (flushRef.current) {
        clearTimeout(flushRef.current);
        flushRef.current = null;
      }
    };
  }, [coins]);

  const rows = positions.map((p) => livePnl(p, mids[p.coin]));

  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Open positions</Widget.Title>
      </Widget.Header>
      <Widget.Content>
        {rows.length ? (
          <div className="flex flex-col">
            {rows.map((p) => (
              <div
                key={p.coin}
                className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
              >
                <div>
                  <span className="font-semibold text-foreground">{p.coin}</span>
                  <Chip className="ml-2" color={+p.szi > 0 ? "success" : "danger"} size="sm">
                    {+p.szi > 0 ? "LONG" : "SHORT"} {p.leverage?.value ? p.leverage.value + "\u00d7" : ""}
                  </Chip>
                  <div className="font-mono text-xs text-muted">
                    {Math.abs(+p.szi)} @ {p.entryPx}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-semibold ${cls(p.unrealizedPnl)}`}>
                    <NumberFlow format={moneyFormatOptions(p.unrealizedPnl, true)} value={+p.unrealizedPnl} />
                  </div>
                  <div className="font-mono text-xs text-muted">
                    <NumberFlow
                      format={{ style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                      suffix=" ROE"
                      value={+p.returnOnEquity}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState size="sm">
            <EmptyState.Header>
              <EmptyState.Title>Flat</EmptyState.Title>
              <EmptyState.Description>No open perp positions.</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        )}
      </Widget.Content>
    </Widget>
  );
}
