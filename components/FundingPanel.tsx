import { Widget } from "@heroui-pro/react";
import NumberFlow from "@number-flow/react";
import { cls, moneyFormatOptions } from "@/lib/format";

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
    <Widget>
      <Widget.Header>
        <Widget.Title>Funding</Widget.Title>
        <Widget.Description>{wLbl}</Widget.Description>
      </Widget.Header>
      <Widget.Content>
        <NumberFlow className={`text-2xl font-bold ${cls(fundTot)}`} format={moneyFormatOptions(fundTot, true)} value={fundTot} />
        <div className="mt-1 text-xs text-muted">{fundingCount} funding payments &middot; net paid/received</div>
      </Widget.Content>
    </Widget>
  );
}
