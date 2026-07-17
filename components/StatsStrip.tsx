import { cls, moneyFormatOptions } from "@/lib/format";
import { KPI, KPIGroup } from "@heroui-pro/react";
import { ScrollShadow } from "@heroui/react";

type AccountBreakdown = { perp: number; spot: number; vault: number; staked: number; total: number };

type StatItem = {
  key: string;
  title: React.ReactNode;
  value: number;
  options: ReturnType<typeof moneyFormatOptions>;
  valueClassName?: string;
  itemClassName?: string;
};

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
  const items: StatItem[] = [
    { key: "account", title: "Account value", value: acct.spot, options: moneyFormatOptions(acct.spot) },
    ...periodValues.map(([k, l, v]) => ({
      key: k,
      title: `PnL ${l}`,
      value: v,
      options: moneyFormatOptions(v, true),
      valueClassName: cls(v),
    })),
    ...(custom
      ? [
        {
          key: "custom",
          title: `PnL ${customLabel}`,
          value: customValue,
          options: moneyFormatOptions(customValue, true),
          valueClassName: cls(customValue),
        },
      ]
      : []),
    { key: "volume", title: "Lifetime volume", value: vol, options: moneyFormatOptions(vol), valueClassName: "text-muted" },
  ];

  const desktopGridCols = items.length >= 7 ? "sm:grid-cols-4 lg:grid-cols-7" : "sm:grid-cols-3 lg:grid-cols-6";

  const renderKpi = (item: StatItem, className?: string) => (
    <KPI key={item.key} className={[item.itemClassName, className].filter(Boolean).join(" ")}>
      <KPI.Header>
        <KPI.Title>{item.title}</KPI.Title>
      </KPI.Header>
      <KPI.Content>
        <KPI.Value className={item.valueClassName} value={item.value} {...item.options} />
      </KPI.Content>
    </KPI>
  );

  return (
    <>
      <ScrollShadow className="mb-4 sm:hidden" hideScrollBar orientation="horizontal">
        <KPIGroup className="w-max">{items.map((item) => renderKpi(item, "w-[150px] flex-none"))}</KPIGroup>
      </ScrollShadow>
      <KPIGroup className={`mb-4 hidden sm:grid ${desktopGridCols}`}>{items.map((item) => renderKpi(item))}</KPIGroup>
    </>
  );
}
