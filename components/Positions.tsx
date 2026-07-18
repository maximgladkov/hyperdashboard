"use client";

import { Button, Chip, toast } from "@heroui/react";
import { EmptyState, PressableFeedback, Widget } from "@heroui-pro/react";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { livePnl } from "@/lib/compute";
import { cls, moneyFormatOptions } from "@/lib/format";
import { closePosition } from "@/lib/trade";
import { useMarkPrices } from "@/lib/useMarkPrice";
import type { Position } from "@/lib/types";

export default function Positions({ positions, address }: { positions: Position[]; address?: string }) {
  const [closing, setClosing] = useState(false);
  const mids = useMarkPrices();

  const rows = positions.map((p) => livePnl(p, mids[p.coin]));

  const handleCloseAll = async () => {
    if (!address || closing) return;
    setClosing(true);
    try {
      const res = await closePosition(address);
      toast.success(res.closed ? "Sent market close for all positions" : res.reason || "Nothing to close");
    } catch (err) {
      toast.danger("Close failed", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setClosing(false);
    }
  };

  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Open positions</Widget.Title>
      </Widget.Header>
      <Widget.Content>
        {rows.length ? (
          <div className="flex flex-col gap-3">
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
            {address && (
              <Button className="w-full" fullWidth isPending={closing} size="lg" variant="danger-soft">
                <PressableFeedback.HoldConfirm
                  className="bg-danger text-danger-foreground"
                  isDisabled={closing}
                  onComplete={handleCloseAll}
                >
                  Release to close all
                </PressableFeedback.HoldConfirm>
                {closing ? "Closing…" : "Hold to close all positions"}
              </Button>
            )}
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
