import { cls, moneyFormatOptions } from "@/lib/format";
import type { CoinAgg } from "@/lib/types";
import { EmptyState, Widget } from "@heroui-pro/react";
import { Table } from "@heroui/react";
import NumberFlow from "@number-flow/react";

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
          {wLbl}
        </Widget.Description>
      </Widget.Header>
      <Widget.Content className={coins.length ? "p-0" : undefined}>
        {coins.length ? (
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Realized PnL by market" className="min-w-[520px] font-mono text-sm">
                <Table.Header className="[&>tr>th]:bg-transparent!">
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
                      <Table.Cell className={`text-right ${cls(c.realized)}`}>
                        <NumberFlow format={moneyFormatOptions(c.realized, true)} value={c.realized} />
                      </Table.Cell>
                      <Table.Cell className="text-right text-muted">
                        <NumberFlow format={moneyFormatOptions(-c.fees)} value={-c.fees} />
                      </Table.Cell>
                      <Table.Cell className={`text-right font-semibold ${cls(c.net)}`}>
                        <NumberFlow format={moneyFormatOptions(c.net, true)} value={c.net} />
                      </Table.Cell>
                      <Table.Cell className="text-right text-muted">
                        {c.closes ? (
                          <NumberFlow format={{ style: "percent", maximumFractionDigits: 0 }} value={c.wins / c.closes} />
                        ) : (
                          "\u2014"
                        )}
                      </Table.Cell>
                      <Table.Cell className="text-right text-muted">
                        <NumberFlow value={c.trades} />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                  <Table.Row id="__total">
                    <Table.Cell className="text-muted font-normal">Total</Table.Cell>
                    <Table.Cell className={`text-right ${cls(totR)}`}>
                      <NumberFlow format={moneyFormatOptions(totR, true)} value={totR} />
                    </Table.Cell>
                    <Table.Cell className="text-right text-muted">
                      <NumberFlow format={moneyFormatOptions(-totF)} value={-totF} />
                    </Table.Cell>
                    <Table.Cell className={`text-right font-bold ${cls(totR - totF)}`}>
                      <NumberFlow format={moneyFormatOptions(totR - totF, true)} value={totR - totF} />
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
