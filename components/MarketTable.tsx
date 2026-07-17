import { cls, usd } from "@/lib/format";
import type { CoinAgg } from "@/lib/types";

export default function MarketTable({
  coins,
  totR,
  totF,
  nTrades,
  wLbl,
}: {
  coins: CoinAgg[];
  totR: number;
  totF: number;
  nTrades: number;
  wLbl: string;
}) {
  return (
    <section className="panel main">
      <div className="ptitle">
        Realized PnL by market
        <span className="psub"> &middot; {nTrades} fills &middot; {wLbl}</span>
      </div>
      {coins.length ? (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Market</th>
                <th>Realized</th>
                <th>Fees</th>
                <th>Net</th>
                <th>Win rate</th>
                <th>Fills</th>
              </tr>
            </thead>
            <tbody>
              {coins.map((c) => (
                <tr key={c.coin}>
                  <td>{c.coin}</td>
                  <td className={cls(c.realized)}>{usd(c.realized, true)}</td>
                  <td className="mut">{usd(-c.fees)}</td>
                  <td className={cls(c.net)} style={{ fontWeight: 600 }}>
                    {usd(c.net, true)}
                  </td>
                  <td className="mut">{c.closes ? Math.round((100 * c.wins) / c.closes) + "%" : "\u2014"}</td>
                  <td className="mut">{c.trades}</td>
                </tr>
              ))}
              <tr>
                <td className="mut" style={{ fontWeight: 400, paddingTop: 12 }}>
                  Total
                </td>
                <td className={cls(totR)} style={{ paddingTop: 12 }}>
                  {usd(totR, true)}
                </td>
                <td className="mut" style={{ paddingTop: 12 }}>
                  {usd(-totF)}
                </td>
                <td className={cls(totR - totF)} style={{ fontWeight: 700, paddingTop: 12 }}>
                  {usd(totR - totF, true)}
                </td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No fills returned for this account.</div>
      )}
    </section>
  );
}
