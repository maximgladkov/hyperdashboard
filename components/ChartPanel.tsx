"use client";

import MainChart from "@/components/charts/MainChart";
import { PERIODS } from "@/lib/compute";
import type { Metric, Period, Range } from "@/lib/types";
import { Segment, Widget } from "@heroui-pro/react";
import { DateField, DateRangePicker, RangeCalendar, Spinner } from "@heroui/react";
import type { DateValue } from "@internationalized/date";
import { parseDate } from "@internationalized/date";
import type { Key } from "react-aria-components";

type Point = { t: number; v: number };

const PERIOD_DESCRIPTIONS: Record<Exclude<Period, "custom">, string> = {
  day: "Last 24 hours",
  week: "Last 7 days",
  month: "Last 30 days",
  allTime: "All time",
};

function msToDateValue(ms: number): DateValue {
  const d = new Date(ms);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return parseDate(iso);
}

export default function ChartPanel({
  metric,
  period,
  wLbl,
  range,
  pendingPeriod,
  series,
  onMetricChange,
  onPeriodChange,
  onRangeChange,
}: {
  metric: Metric;
  period: Period;
  wLbl: string;
  range: Range | null;
  pendingPeriod: Period | null;
  series: Point[];
  onMetricChange: (m: Metric) => void;
  onPeriodChange: (p: Period) => void;
  onRangeChange: (range: Range) => void;
}) {
  const rangeValue =
    period === "custom" && range ? { start: msToDateValue(range.start), end: msToDateValue(range.end) } : null;
  const description = period === "custom" ? wLbl : PERIOD_DESCRIPTIONS[period];

  return (
    <div className="mb-4">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
        <Segment
          selectedKey={metric}
          size="sm"
          onSelectionChange={(k: Key) => onMetricChange(k as Metric)}
        >
          <Segment.Item id="pnl">PnL</Segment.Item>
          <Segment.Item id="equity">Equity</Segment.Item>
        </Segment>
        <div className="flex flex-wrap items-center gap-2">
          <Segment
            disallowEmptySelection={false}
            selectedKey={period}
            size="sm"
            onSelectionChange={(k: Key) => onPeriodChange(k as Period)}
          >
            {PERIODS.map(([k, l]) => (
              <Segment.Item key={k} id={k} isDisabled={pendingPeriod === k}>
                {pendingPeriod === k ? <Spinner size="sm" /> : l}
              </Segment.Item>
            ))}
          </Segment>
          <div className="flex items-center gap-1.5">
            <DateRangePicker
              aria-label="Custom date range"
              isDisabled={pendingPeriod === "custom"}
              value={rangeValue}
              onChange={(v) => {
                if (!v) return;
                onRangeChange({ start: Date.parse(v.start.toString()), end: Date.parse(v.end.toString()) + 86399999 });
              }}
            >
              <DateField.Group variant="secondary">
                <DateField.InputContainer>
                  <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                  <DateRangePicker.RangeSeparator />
                  <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                </DateField.InputContainer>
                <DateField.Suffix>
                  <DateRangePicker.Trigger>
                    <DateRangePicker.TriggerIndicator />
                  </DateRangePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DateRangePicker.Popover>
                <RangeCalendar aria-label="Custom date range">
                  <RangeCalendar.Header>
                    <RangeCalendar.YearPickerTrigger>
                      <RangeCalendar.YearPickerTriggerHeading />
                      <RangeCalendar.YearPickerTriggerIndicator />
                    </RangeCalendar.YearPickerTrigger>
                    <RangeCalendar.NavButton slot="previous" />
                    <RangeCalendar.NavButton slot="next" />
                  </RangeCalendar.Header>
                  <RangeCalendar.Grid>
                    <RangeCalendar.GridHeader>
                      {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                    </RangeCalendar.GridHeader>
                    <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
                  </RangeCalendar.Grid>
                  <RangeCalendar.YearPickerGrid>
                    <RangeCalendar.YearPickerGridBody>
                      {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
                    </RangeCalendar.YearPickerGridBody>
                  </RangeCalendar.YearPickerGrid>
                </RangeCalendar>
              </DateRangePicker.Popover>
            </DateRangePicker>
          </div>
        </div>
      </div>
      <Widget>
        <Widget.Header>
          <Widget.Title>{metric === "pnl" ? "Cumulative PnL" : "Account value"}</Widget.Title>
          <Widget.Description>{description}</Widget.Description>
        </Widget.Header>
        <Widget.Content>
          <MainChart series={series} metric={metric} />
        </Widget.Content>
      </Widget>
    </div>
  );
}
