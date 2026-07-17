import { Separator } from "@heroui/react";
import { NumberValue, Widget } from "@heroui-pro/react";
import { cls, fdate, moneyFormatOptions, usd } from "@/lib/format";

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
    <Widget>
      <Widget.Header>
        <Widget.Title>Capital flows</Widget.Title>
        <Widget.Description>{wLbl}</Widget.Description>
      </Widget.Header>
      <Widget.Content>
        <div className="flex flex-wrap gap-5">
          <div>
            <div className="font-mono text-[10px] tracking-[.14em] text-muted uppercase">In</div>
            <NumberValue className="mt-1 font-mono text-lg font-bold" value={dep} {...moneyFormatOptions(dep)} />
            <div className="text-xs text-muted">{depN} deposits &amp; transfers in</div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[.14em] text-muted uppercase">Out</div>
            <NumberValue className="mt-1 font-mono text-lg font-bold" value={wd} {...moneyFormatOptions(wd)} />
            <div className="text-xs text-muted">{wdN} withdrawals &amp; transfers out</div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[.14em] text-muted uppercase">Net flow</div>
            <NumberValue
              className={`mt-1 font-mono text-lg font-bold ${cls(dep - wd)}`}
              value={dep - wd}
              {...moneyFormatOptions(dep - wd, true)}
            />
            <div className="text-xs text-muted">in &minus; out</div>
          </div>
        </div>
        {recent.length > 0 && (
          <>
            <Separator className="mt-3" />
            <div className="flex flex-col">
              {recent.slice(0, 6).map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
                >
                  <div>
                    <span className="text-sm">{r.kind}</span>
                    <div className="font-mono text-xs text-muted">
                      {fdate(r.t)}
                      {r.fee ? ` \u00b7 fee ${usd(r.fee)}` : ""}
                      {r.to ? ` \u00b7 to ${r.to.slice(0, 6)}\u2026${r.to.slice(-4)}` : ""}
                    </div>
                  </div>
                  <div className="font-mono font-semibold text-danger">&minus;{usd(r.amt)}</div>
                </div>
              ))}
              {wdN > 6 && <div className="pt-2 text-xs text-muted">+ {wdN - 6} earlier outflows</div>}
            </div>
          </>
        )}
      </Widget.Content>
    </Widget>
  );
}
