import { cls, usd } from "@/lib/format";

type AccountBreakdown = { perp: number; spot: number; vault: number; staked: number; total: number };

export default function StatsStrip({
  acct,
  periodValues,
  custom,
  customLabel,
  customValue,
  vol,
}: {
  acct: AccountBreakdown;
  periodValues: [string, string, number][];
  custom: boolean;
  customLabel: string;
  customValue: number;
  vol: number;
}) {
  const meta = ([
    ["Perps", acct.perp],
    ["Vaults", acct.vault],
    ["Staked", acct.staked],
    ["Total", acct.total],
  ] as [string, number][]).filter(([, v]) => v >= 0.5);

  return (
    <section className="strip">
      <div className="stat">
        <div className="lbl">Account value &middot; spot</div>
        <div className="val big">{usd(acct.spot)}</div>
        <div className="meta" style={{ color: "var(--dim)", fontSize: 11, fontFamily: "var(--mono)", marginTop: 4 }}>
          {meta.map(([l, v]) => `${l} ${usd(v)}`).join(" \u00b7 ")}
        </div>
      </div>
      {periodValues.map(([k, l, v]) => (
        <div className="stat" key={k}>
          <div className="lbl">PnL {l}</div>
          <div className={`val ${cls(v)}`}>{usd(v, true)}</div>
        </div>
      ))}
      {custom && (
        <div className="stat" style={{ borderColor: "var(--mint)" }}>
          <div className="lbl">PnL {customLabel}</div>
          <div className={`val ${cls(customValue)}`}>{usd(customValue, true)}</div>
        </div>
      )}
      <div className="stat">
        <div className="lbl">Lifetime volume</div>
        <div className="val mut">{usd(vol)}</div>
      </div>
    </section>
  );
}
