import { Chip } from "@heroui/react";
import { EmptyState, Widget } from "@heroui-pro/react";
import { cls, usd } from "@/lib/format";
import type { Position } from "@/lib/types";

export default function Positions({ positions }: { positions: Position[] }) {
  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Open positions</Widget.Title>
      </Widget.Header>
      <Widget.Content>
        {positions.length ? (
          <div className="flex flex-col">
            {positions.map((p) => (
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
                  <div className={`font-mono font-semibold ${cls(p.unrealizedPnl)}`}>{usd(p.unrealizedPnl, true)}</div>
                  <div className="font-mono text-xs text-muted">{(+p.returnOnEquity * 100).toFixed(1)}% ROE</div>
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
