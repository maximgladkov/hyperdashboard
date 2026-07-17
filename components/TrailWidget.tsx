"use client";

import { moneyFormatOptions } from "@/lib/format";
import { info } from "@/lib/hyperliquid";
import type { TenantState, TrailType } from "@/lib/trail";
import { EmptyState, NumberStepper, Segment, Widget } from "@heroui-pro/react";
import { Chip, Separator, Spinner, Switch } from "@heroui/react";
import NumberFlow from "@number-flow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Key } from "react-aria-components";

const POLL_MS = 3000;
const PCT_MIN = 0.001;
const PCT_MAX = 90;
const ABS_MIN = 100;
const ABS_MAX = 1_000_000;
const ABS_STEP = 100;
const WRITE_DEBOUNCE_MS = 450;
const ABS_FORMAT = { style: "currency", currency: "USD", maximumFractionDigits: 0 } as const;

const roundToHundred = (n: number) => Math.round(n / ABS_STEP) * ABS_STEP;

type StateResponse = { managed: false } | { managed: true; state: TenantState | null } | { error: string };

async function fetchTrailState(address: string): Promise<StateResponse> {
  const r = await fetch(`/api/trail/state?address=${address}`, { cache: "no-store" });
  return r.json();
}

async function writeTrailConfig(
  address: string,
  effectiveType: TrailType,
  fields: { type?: TrailType; value?: number; enabled?: boolean }
): Promise<void> {
  await fetch("/api/trail/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, effectiveType, ...fields }),
  });
}

export default function TrailWidget({ address }: { address: string }) {
  const [managed, setManaged] = useState<boolean | null>(null);
  const [state, setState] = useState<TenantState | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  const [localType, setLocalType] = useState<TrailType>("pct");
  const [localPct, setLocalPct] = useState(2);
  const [localAbs, setLocalAbs] = useState(100);
  const [localEnabled, setLocalEnabled] = useState(true);
  const seededRef = useRef(false);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetchTrailState(address);
        if (cancelled) return;
        if ("error" in res) {
          setFetchError(res.error);
          return;
        }
        setFetchError(null);
        setManaged(res.managed);
        if (res.managed) {
          setState(res.state);
          if (!seededRef.current && res.state?.trail) {
            seededRef.current = true;
            const { trail } = res.state;
            setLocalType(trail.type);
            setLocalEnabled(trail.enabled);
            if (trail.type === "pct") setLocalPct(+(trail.value * 100).toFixed(2));
            else setLocalAbs(roundToHundred(trail.value));
          }
        }
      } catch (err) {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : String(err));
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address]);

  useEffect(() => {
    if (!state?.coin) return;
    let cancelled = false;
    const pollPrice = async () => {
      try {
        const mids = await info<Record<string, string>>({ type: "allMids" });
        if (cancelled) return;
        const mid = +mids[state.coin];
        if (mid) setLivePrice(mid);
      } catch { }
    };
    pollPrice();
    const id = setInterval(pollPrice, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [state?.coin]);

  const scheduleWrite = useCallback(
    (effectiveType: TrailType, fields: { type?: TrailType; value?: number; enabled?: boolean }, immediate = false) => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
      const run = () => writeTrailConfig(address, effectiveType, fields);
      if (immediate) run();
      else writeTimerRef.current = setTimeout(run, WRITE_DEBOUNCE_MS);
    },
    [address]
  );

  const handleUnitChange = (key: Key) => {
    const type = key as TrailType;
    setLocalType(type);
    const value = type === "pct" ? localPct / 100 : localAbs;
    scheduleWrite(type, { type, value }, true);
  };

  const handlePctChange = (v: number) => {
    setLocalPct(v);
    scheduleWrite("pct", { value: v / 100 });
  };

  const handleAbsChange = (v: number) => {
    const rounded = roundToHundred(v);
    setLocalAbs(rounded);
    scheduleWrite("abs", { value: rounded });
  };

  const handleEnabledChange = (v: boolean) => {
    setLocalEnabled(v);
    scheduleWrite(localType, { enabled: v }, true);
  };

  const priceToShow = livePrice ?? state?.price ?? null;

  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Auto-trail{state?.coin ? ` \u00b7 ${state.coin}` : ""}</Widget.Title>
        {managed !== true && <Widget.Description>Hyperliquid trailing-stop bot</Widget.Description>}
      </Widget.Header>
      <Widget.Content>
        {managed === null && !fetchError && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted">
            <Spinner size="sm" />
            Checking trail bot…
          </div>
        )}

        {fetchError && managed === null && (
          <EmptyState size="sm">
            <EmptyState.Header>
              <EmptyState.Title>Trail service unreachable</EmptyState.Title>
              <EmptyState.Description>{fetchError}</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        )}

        {managed === false && (
          <EmptyState size="sm">
            <EmptyState.Header>
              <EmptyState.Title>Not managed</EmptyState.Title>
              <EmptyState.Description>This address isn&apos;t managed by the trail bot.</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        )}

        {managed === true && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <Switch isSelected={localEnabled} onChange={handleEnabledChange}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Trailing enabled
                </Switch.Content>
              </Switch>
              {priceToShow !== null && (
                <div className="text-right">
                  <div className="font-mono text-[10px] tracking-[.14em] text-muted uppercase">Mark price</div>
                  <NumberFlow className="font-mono text-lg font-bold" format={moneyFormatOptions(priceToShow)} value={priceToShow} />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Segment selectedKey={localType} size="sm" onSelectionChange={handleUnitChange}>
                <Segment.Item id="pct">%</Segment.Item>
                <Segment.Item id="abs">$</Segment.Item>
              </Segment>
              {localType === "pct" ? (
                <NumberStepper
                  aria-label="Trail distance percent"
                  formatOptions={{ style: "unit", unit: "percent", maximumFractionDigits: 1 }}
                  maxValue={PCT_MAX}
                  minValue={PCT_MIN}
                  size="sm"
                  step={0.001}
                  value={localPct}
                  onChange={handlePctChange}
                >
                  <NumberStepper.Group>
                    <NumberStepper.DecrementButton />
                    <NumberStepper.Value />
                    <NumberStepper.IncrementButton />
                  </NumberStepper.Group>
                </NumberStepper>
              ) : (
                <NumberStepper
                  aria-label="Trail distance amount"
                  formatOptions={ABS_FORMAT}
                  maxValue={ABS_MAX}
                  minValue={ABS_MIN}
                  size="sm"
                  step={ABS_STEP}
                  value={localAbs}
                  onChange={handleAbsChange}
                >
                  <NumberStepper.Group>
                    <NumberStepper.DecrementButton />
                    <NumberStepper.Value className="mx-2" />
                    <NumberStepper.IncrementButton />
                  </NumberStepper.Group>
                </NumberStepper>
              )}
            </div>

            <Separator />

            <TrailSummary state={state} />
          </div>
        )}
      </Widget.Content>
    </Widget>
  );
}

function TrailSummary({ state }: { state: TenantState | null }) {
  if (!state) {
    return <div className="text-xs text-muted">Waiting for the first snapshot…</div>;
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">Effective trail</span>
        <span className="font-mono font-semibold">
          {state.trail.type === "pct" ? (
            <NumberFlow format={{ style: "percent", maximumFractionDigits: 2 }} value={state.trail.value} />
          ) : (
            <NumberFlow format={moneyFormatOptions(state.trail.value)} value={state.trail.value} />
          )}
          {" "}
          <Chip color={state.trail.enabled ? "success" : "default"} size="sm">
            {state.trail.enabled ? "ON" : "OFF"}
          </Chip>
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">Position</span>
        {state.position ? (
          <span className="flex items-center gap-2 font-mono">
            <Chip color={state.position.side === "long" ? "success" : "danger"} size="sm">
              {state.position.side.toUpperCase()}
            </Chip>
            <NumberFlow value={state.position.size} /> @{" "}
            <NumberFlow format={moneyFormatOptions(state.position.entryPx)} value={state.position.entryPx} />
          </span>
        ) : (
          <span className="text-muted">Flat</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">Resting stop</span>
        {state.stop ? (
          <span className="font-mono">
            <NumberFlow format={moneyFormatOptions(state.stop.triggerPx)} value={state.stop.triggerPx} />
            <span className="ml-1.5 text-xs text-muted">#{state.stop.orderId}</span>
          </span>
        ) : (
          <span className="text-muted">None</span>
        )}
      </div>

      <Separator />

      <div>
        <div className="font-mono text-[10px] tracking-[.14em] text-muted uppercase">Last action</div>
        <div className="mt-1 text-sm">{state.lastAction || "\u2014"}</div>
      </div>

      <div className="text-xs text-muted">Updated {new Date(state.updatedAt).toLocaleTimeString()}</div>
    </div>
  );
}
