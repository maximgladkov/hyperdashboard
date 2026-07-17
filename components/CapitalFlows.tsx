import { cls, fdate, usd } from "@/lib/format";

type RecentFlow = { t: number; kind: string; amt: number; fee?: number; to?: string };

export default function CapitalFlows({
  dep,
  depN,
  wd,
  wdN,
  recent,
  wLbl,
}: {
  dep: number;
  depN: number;
  wd: number;
  wdN: number;
  recent: RecentFlow[];
  wLbl: string;
}) {
  return (
    <section className="panel">
      <div className="ptitle">Capital flows &middot; {wLbl}</div>
      <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
        <div>
          <div
            className="lbl"
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: ".14em",
              color: "var(--dim)",
              textTransform: "uppercase",
            }}
          >
            In
          </div>
          <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 18, marginTop: 4 }}>{usd(dep)}</div>
          <div className="meta" style={{ color: "var(--dim)", fontSize: 11 }}>
            {depN} deposits &amp; transfers in
          </div>
        </div>
        <div>
          <div
            className="lbl"
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: ".14em",
              color: "var(--dim)",
              textTransform: "uppercase",
            }}
          >
            Out
          </div>
          <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 18, marginTop: 4 }}>{usd(wd)}</div>
          <div className="meta" style={{ color: "var(--dim)", fontSize: 11 }}>
            {wdN} withdrawals &amp; transfers out
          </div>
        </div>
        <div>
          <div
            className="lbl"
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: ".14em",
              color: "var(--dim)",
              textTransform: "uppercase",
            }}
          >
            Net flow
          </div>
          <div
            className={cls(dep - wd)}
            style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 18, marginTop: 4 }}
          >
            {usd(dep - wd, true)}
          </div>
          <div className="meta" style={{ color: "var(--dim)", fontSize: 11 }}>
            in &minus; out
          </div>
        </div>
      </div>
      {recent.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid rgba(22,51,44,.5)" }}>
          {recent.slice(0, 6).map((r, i) => (
            <div className="posrow" key={i}>
              <div>
                <span style={{ fontSize: 13 }}>{r.kind}</span>
                <div className="meta">
                  {fdate(r.t)}
                  {r.fee ? ` \u00b7 fee ${usd(r.fee)}` : ""}
                  {r.to ? ` \u00b7 to ${r.to.slice(0, 6)}\u2026${r.to.slice(-4)}` : ""}
                </div>
              </div>
              <div className="neg" style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>
                &minus;{usd(r.amt)}
              </div>
            </div>
          ))}
          {wdN > 6 && (
            <div className="meta" style={{ paddingTop: 8, color: "var(--dim)", fontSize: 11 }}>
              + {wdN - 6} earlier outflows
            </div>
          )}
        </div>
      )}
    </section>
  );
}
