import { cls, usd } from "@/lib/format";
import type { Position } from "@/lib/types";

export default function Positions({ positions }: { positions: Position[] }) {
  return (
    <section className="panel">
      <div className="ptitle">Open positions</div>
      {positions.length ? (
        positions.map((p) => (
          <div className="posrow" key={p.coin}>
            <div>
              <span style={{ fontWeight: 600 }}>{p.coin}</span>
              <span className={+p.szi > 0 ? "pos" : "neg"} style={{ marginLeft: 8, fontSize: 12 }}>
                {+p.szi > 0 ? "LONG" : "SHORT"} {p.leverage?.value ? p.leverage.value + "\u00d7" : ""}
              </span>
              <div className="meta">
                {Math.abs(+p.szi)} @ {p.entryPx}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className={cls(p.unrealizedPnl)} style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>
                {usd(p.unrealizedPnl, true)}
              </div>
              <div className="meta">{(+p.returnOnEquity * 100).toFixed(1)}% ROE</div>
            </div>
          </div>
        ))
      ) : (
        <div className="empty">Flat &mdash; no open perp positions.</div>
      )}
    </section>
  );
}
