"use client";

import { usd } from "@/lib/format";
import { fetchOpenOrders } from "@/lib/hyperliquid";
import { orderLabel, orderPrice } from "@/lib/orders";
import { cancelOrder } from "@/lib/trade";
import type { OpenOrder } from "@/lib/types";
import { Button, Chip, toast } from "@heroui/react";
import { EmptyState, PressableFeedback, Widget } from "@heroui-pro/react";
import { useEffect, useState } from "react";

const POLL_MS = 5000;

export default function OpenOrders({ address }: { address: string }) {
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const handleCancel = async (order: OpenOrder) => {
    if (cancelling != null) return;
    setCancelling(order.oid);
    try {
      await cancelOrder(address, order.oid);
      setOrders((prev) => prev.filter((o) => o.oid !== order.oid));
      toast.success(`Cancelled ${order.coin} order`);
    } catch (err) {
      toast.danger("Cancel failed", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setCancelling(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const list = await fetchOpenOrders(address);
      if (cancelled) return;
      setOrders(list.filter((o) => !o.isTrigger));
      setLoaded(true);
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address]);

  const rows = [...orders].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Open orders</Widget.Title>
        {rows.length > 0 && <Widget.Description>{rows.length} limit</Widget.Description>}
      </Widget.Header>
      <Widget.Content>
        {!loaded ? (
          <div className="py-4 text-sm text-muted">Loading…</div>
        ) : rows.length ? (
          <div className="flex flex-col">
            {rows.map((o) => (
              <div
                key={o.oid}
                className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
              >
                <div>
                  <span className="font-semibold text-foreground">{o.coin}</span>
                  <Chip className="ml-2" color={o.side === "B" ? "success" : "danger"} size="sm">
                    {o.side === "B" ? "BUY" : "SELL"}
                  </Chip>
                  {o.reduceOnly && (
                    <Chip className="ml-1" color="default" size="sm">
                      Reduce
                    </Chip>
                  )}
                  <div className="font-mono text-xs text-muted">
                    {orderLabel(o)} &middot; {+o.sz} @ {usd(orderPrice(o))}
                  </div>
                </div>
                <Button
                  className="shrink-0"
                  isPending={cancelling === o.oid}
                  size="sm"
                  variant="danger-soft"
                >
                  <PressableFeedback.HoldConfirm
                    className="bg-danger text-danger-foreground"
                    isDisabled={cancelling != null}
                    onComplete={() => handleCancel(o)}
                  >
                    Release
                  </PressableFeedback.HoldConfirm>
                  {cancelling === o.oid ? "Cancelling…" : "Hold to cancel"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState size="sm">
            <EmptyState.Header>
              <EmptyState.Title>No resting limit orders</EmptyState.Title>
              <EmptyState.Description>Open limit orders will appear here. Stop and take-profit orders are shown on the Trade Wheel.</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        )}
      </Widget.Content>
    </Widget>
  );
}
