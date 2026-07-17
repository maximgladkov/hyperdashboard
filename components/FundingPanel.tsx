import { cls, usd } from "@/lib/format";

export default function FundingPanel({
  fundTot,
  fundingCount,
  wLbl,
}: {
  fundTot: number;
  fundingCount: number;
  wLbl: string;
}) {
  return (
    <section className="panel">
      <div className="ptitle">Funding &middot; {wLbl}</div>
      <div className={`bignum ${cls(fundTot)}`}>{usd(fundTot, true)}</div>
      <div className="meta" style={{ marginTop: 4, color: "var(--dim)", fontSize: 12 }}>
        {fundingCount} funding payments &middot; net paid/received
      </div>
    </section>
  );
}
