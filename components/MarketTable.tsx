import { Table } from "@heroui/react";
import { EmptyState, Widget } from "@heroui-pro/react";
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
    <Widget>
      <Widget.Header>
        <Widget.Title>Realized PnL by market</Widget.Title>
        <Widget.Description>
          {nTrades} fills &middot; {wLbl}
        </Widget.Description>
      </Widget.Header>
      <Widget.Content className={coins.length ? "p-0" : undefined}>
        {coins.length ? (
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Realized PnL by market" className="min-w-[520px] font-mono text-sm">
                <Table.Header>
                  <Table.Column isRowHeader>Market</Table.Column>
                  <Table.Column className="text-right">Realized</Table.Column>
                  <Table.Column className="text-right">Fees</Table.Column>
                  <Table.Column className="text-right">Net</Table.Column>
                  <Table.Column className="text-right">Win rate</Table.Column>
                  <Table.Column className="text-right">Fills</Table.Column>
                </Table.Header>
                <Table.Body>
                  {coins.map((c) => (
                    <Table.Row key={c.coin} id={c.coin}>
                      <Table.Cell className="font-semibold text-foreground">{c.coin}</Table.Cell>
                      <Table.Cell className={`text-right ${cls(c.realized)}`}>{usd(c.realized, true)}</Table.Cell>
                      <Table.Cell className="text-right text-muted">{usd(-c.fees)}</Table.Cell>
                      <Table.Cell className={`text-right font-semibold ${cls(c.net)}`}>{usd(c.net, true)}</Table.Cell>
                      <Table.Cell className="text-right text-muted">
                        {c.closes ? Math.round((100 * c.wins) / c.closes) + "%" : "\u2014"}
                      </Table.Cell>
                      <Table.Cell className="text-right text-muted">{c.trades}</Table.Cell>
                    </Table.Row>
                  ))}
                  <Table.Row id="__total">
                    <Table.Cell className="text-muted font-normal">Total</Table.Cell>
                    <Table.Cell className={`text-right ${cls(totR)}`}>{usd(totR, true)}</Table.Cell>
                    <Table.Cell className="text-right text-muted">{usd(-totF)}</Table.Cell>
                    <Table.Cell className={`text-right font-bold ${cls(totR - totF)}`}>
                      {usd(totR - totF, true)}
                    </Table.Cell>
                    <Table.Cell />
                    <Table.Cell />
                  </Table.Row>
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        ) : (
          <EmptyState size="sm">
            <EmptyState.Header>
              <EmptyState.Title>No fills</EmptyState.Title>
              <EmptyState.Description>No fills returned for this account.</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        )}
      </Widget.Content>
    </Widget>
  );
}
