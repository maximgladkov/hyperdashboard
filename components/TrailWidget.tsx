"use client";

import { StepperField } from "@/components/StepperField";
import { moneyFormatOptions } from "@/lib/format";
import { info } from "@/lib/hyperliquid";
import { usePriceStep } from "@/lib/tradeSteps";
import type { TenantState, TrailType } from "@/lib/trail";
import { EmptyState, Widget } from "@heroui-pro/react";
import { Chip, Separator, Spinner, Switch } from "@heroui/react";
import NumberFlow from "@number-flow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Key } from "react-aria-components";

const POLL_MS = 3000;
const PCT_MIN = 0.001;
const PCT_MAX = 90;
const ABS_MIN = 50;
const ABS_MAX = 1_000_000;
const WRITE_DEBOUNCE_MS = 450;

const roundToStep = (n: number, step: number) => Math.round(n / step) * step;

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
  const [priceStep] = usePriceStep();
  const [localType, setLocalType] = useState<TrailType>("pct");
  const [localPct, setLocalPct] = useState(2);
  const [localAbs, setLocalAbs] = useState(100);
  const [localEnabled, setLocalEnabled] = useState(true);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncOnNextPollRef = useRef(true);
  const mountedRef = useRef(true);

  const applyTrailToLocal = useCallback(
    (trail: TenantState["trail"]) => {
      setLocalType(trail.type);
      setLocalEnabled(trail.enabled);
      if (trail.type === "pct") setLocalPct(+(trail.value * 100).toFixed(2));
      else setLocalAbs(roundToStep(trail.value, priceStep));
    },
    [priceStep]
  );

  const poll = useCallback(async () => {
    try {
      const res = await fetchTrailState(address);
      if (!mountedRef.current) return;
      if ("error" in res) {
        setFetchError(res.error);
        return;
      }
      setFetchError(null);
      setManaged(res.managed);
      if (res.managed) {
        setState(res.state);
        const trail = res.state?.trail;
        if (trail && syncOnNextPollRef.current) {
          syncOnNextPollRef.current = false;
          applyTrailToLocal(trail);
        }
      }
    } catch (err) {
      if (mountedRef.current) setFetchError(err instanceof Error ? err.message : String(err));
    }
  }, [address, applyTrailToLocal]);

  useEffect(() => {
    mountedRef.current = true;
    syncOnNextPollRef.current = true;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [poll]);

  useEffect(() => {
    const resync = () => {
      if (document.visibilityState !== "visible") return;
      syncOnNextPollRef.current = true;
      poll();
    };
    window.addEventListener("focus", resync);
    document.addEventListener("visibilitychange", resync);
    return () => {
      window.removeEventListener("focus", resync);
      document.removeEventListener("visibilitychange", resync);
    };
  }, [poll]);

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
    const rounded = roundToStep(v, priceStep);
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
            <Switch isSelected={localEnabled} onChange={handleEnabledChange} className="flex flex-row items-center justify-between gap-2">
              Trailing enabled
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>

            <Separator />

            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-4">
                {/* <Segment selectedKey={localType} size="sm" onSelectionChange={handleUnitChange}>
                <Segment.Item id="pct">%</Segment.Item>
                <Segment.Item id="abs">$</Segment.Item
                >
              </Segment> */}
                {localType === "pct" ? (
                  <StepperField
                    aria-label="Trail distance percent"
                    label="Trail distance"
                    maxValue={PCT_MAX}
                    minValue={PCT_MIN}
                    size="sm"
                    step={0.001}
                    suffix="%"
                    value={localPct}
                    onChange={handlePctChange}
                  />
                ) : (
                  <StepperField
                    aria-label="Trail distance amount"
                    group
                    label="Trail distance"
                    maxValue={ABS_MAX}
                    minValue={ABS_MIN}
                    prefix="$"
                    step={priceStep}
                    value={localAbs}
                    valueClassName="mx-3 text-sm"
                    onChange={handleAbsChange}
                  />
                )}
              </div>

              {priceToShow !== null && (
                <div className="text-right">
                  <div className="font-mono text-[10px] tracking-[.14em] text-muted uppercase">Mark price</div>
                  <NumberFlow className="font-mono text-xl font-bold" format={moneyFormatOptions(priceToShow)} value={priceToShow} />
                </div>
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
          </span>
        ) : (
          <span className="text-muted">None</span>
        )}
      </div>

      <Separator />

      <div className="font-mono text-[10px] tracking-[.14em] text-muted uppercase mt-1">Last action</div>
      <div className="text-sm">{state.lastAction || "\u2014"}</div>
      <div className="text-xs text-muted">Updated {new Date(state.updatedAt).toLocaleTimeString()}</div>
    </div>
  );
}
