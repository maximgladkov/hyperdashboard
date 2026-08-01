"use client";

import { StepperField } from "@/components/StepperField";
import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";
import { moneyFormatOptions } from "@/lib/format";
import { usePositionStep, usePriceStep, useTradeSize } from "@/lib/tradeSteps";
import type { TenantState } from "@/lib/trail";
import { useMarkPrice } from "@/lib/useMarkPrice";
import { EmptyState, Widget } from "@heroui-pro/react";
import { Chip, Separator, Spinner, Switch } from "@heroui/react";
import NumberFlow from "@number-flow/react";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 3000;
const WRITE_DEBOUNCE_MS = 450;
const DEFAULT_BAND_STEPS = 5;

const roundToStep = (n: number, step: number) => Math.round(n / step) * step;

type StateResponse =
  | { managed: false }
  | { managed: true; state: TenantState | null }
  | { error: string };

async function fetchTrailState(address: string): Promise<StateResponse> {
  const r = await fetch(`/api/trail/state?address=${address}`, { cache: "no-store" });
  return r.json();
}

async function writeTunnelConfig(
  address: string,
  fields: { enabled?: boolean; low?: number; high?: number; size?: number }
): Promise<void> {
  await fetch("/api/tunnel/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, ...fields }),
  });
}

export default function TunnelWidget({ address }: { address: string }) {
  const [managed, setManaged] = useState<boolean | null>(null);
  const [state, setState] = useState<TenantState | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [priceStep] = usePriceStep();
  const [positionStep] = usePositionStep();
  const [defaultSize] = useTradeSize();
  const [localEnabled, setLocalEnabled] = useState(false);
  const [localLow, setLocalLow] = useState(0);
  const [localHigh, setLocalHigh] = useState(0);
  const [localSize, setLocalSize] = useState(defaultSize);
  const [boundsReady, setBoundsReady] = useState(false);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncOnNextPollRef = useRef(true);
  const mountedRef = useRef(true);
  const defaultsSeededRef = useRef(false);

  const applyTunnelToLocal = useCallback(
    (tunnel: NonNullable<TenantState["tunnel"]>) => {
      setLocalEnabled(tunnel.enabled);
      setLocalLow(roundToStep(tunnel.low, priceStep));
      setLocalHigh(roundToStep(tunnel.high, priceStep));
      setLocalSize(tunnel.size);
      setBoundsReady(true);
      defaultsSeededRef.current = true;
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
        const tunnel = res.state?.tunnel;
        if (tunnel && syncOnNextPollRef.current) {
          syncOnNextPollRef.current = false;
          applyTunnelToLocal(tunnel);
        }
      }
    } catch (err) {
      if (mountedRef.current) setFetchError(err instanceof Error ? err.message : String(err));
    }
  }, [address, applyTunnelToLocal]);

  useEffect(() => {
    mountedRef.current = true;
    syncOnNextPollRef.current = true;
    defaultsSeededRef.current = false;
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

  const livePrice = useMarkPrice(state?.coin);

  useEffect(() => {
    if (defaultsSeededRef.current || boundsReady) return;
    const mark = livePrice ?? state?.price;
    if (mark == null || !Number.isFinite(mark) || priceStep <= 0) return;
    const band = DEFAULT_BAND_STEPS * priceStep;
    setLocalLow(roundToStep(mark - band, priceStep));
    setLocalHigh(roundToStep(mark + band, priceStep));
    setLocalSize(defaultSize);
    setBoundsReady(true);
    defaultsSeededRef.current = true;
  }, [livePrice, state?.price, priceStep, defaultSize, boundsReady]);

  const scheduleWrite = useCallback(
    (fields: { enabled?: boolean; low?: number; high?: number; size?: number }, immediate = false) => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
      const run = () => writeTunnelConfig(address, fields);
      if (immediate) run();
      else writeTimerRef.current = setTimeout(run, WRITE_DEBOUNCE_MS);
    },
    [address]
  );

  const handleEnabledChange = (v: boolean) => {
    if (v && localHigh <= localLow) return;
    setLocalEnabled(v);
    scheduleWrite({ enabled: v, low: localLow, high: localHigh, size: localSize }, true);
  };

  const handleLowChange = (v: number) => {
    const rounded = roundToStep(v, priceStep);
    if (rounded >= localHigh) return;
    setLocalLow(rounded);
    scheduleWrite({ low: rounded, high: localHigh });
  };

  const handleHighChange = (v: number) => {
    const rounded = roundToStep(v, priceStep);
    if (rounded <= localLow) return;
    setLocalHigh(rounded);
    scheduleWrite({ low: localLow, high: rounded });
  };

  const handleSizeChange = (v: number) => {
    setLocalSize(v);
    scheduleWrite({ size: v });
  };

  const priceToShow = livePrice ?? state?.price ?? null;

  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Tunnel{state?.coin ? ` \u00b7 ${state.coin}` : ""}</Widget.Title>
        {managed !== true && <Widget.Description>Range maker orders at high and low</Widget.Description>}
      </Widget.Header>
      <Widget.Content>
        <WidgetErrorBoundary label="Tunnel">
          <TunnelWidgetBody
            fetchError={fetchError}
            localEnabled={localEnabled}
            localHigh={localHigh}
            localLow={localLow}
            localSize={localSize}
            managed={managed}
            positionStep={positionStep}
            priceStep={priceStep}
            priceToShow={priceToShow}
            state={state}
            boundsReady={boundsReady}
            onEnabledChange={handleEnabledChange}
            onHighChange={handleHighChange}
            onLowChange={handleLowChange}
            onSizeChange={handleSizeChange}
          />
        </WidgetErrorBoundary>
      </Widget.Content>
    </Widget>
  );
}

function TunnelWidgetBody({
  managed,
  fetchError,
  localEnabled,
  localLow,
  localHigh,
  localSize,
  boundsReady,
  priceStep,
  positionStep,
  priceToShow,
  state,
  onEnabledChange,
  onLowChange,
  onHighChange,
  onSizeChange,
}: {
  managed: boolean | null;
  fetchError: string | null;
  localEnabled: boolean;
  localLow: number;
  localHigh: number;
  localSize: number;
  boundsReady: boolean;
  priceStep: number;
  positionStep: number;
  priceToShow: number | null;
  state: TenantState | null;
  onEnabledChange: (v: boolean) => void;
  onLowChange: (v: number) => void;
  onHighChange: (v: number) => void;
  onSizeChange: (v: number) => void;
}) {
  if (managed === null && !fetchError) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted">
        <Spinner size="sm" />
        Checking tunnel bot…
      </div>
    );
  }

  if (fetchError && managed === null) {
    return (
      <EmptyState size="sm">
        <EmptyState.Header>
          <EmptyState.Title>Tunnel service unreachable</EmptyState.Title>
          <EmptyState.Description>{fetchError}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    );
  }

  if (managed === false) {
    return (
      <EmptyState size="sm">
        <EmptyState.Header>
          <EmptyState.Title>Not managed</EmptyState.Title>
          <EmptyState.Description>This address isn&apos;t managed by the bot.</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    );
  }

  if (managed !== true) return null;

  return (
    <div className="flex flex-col gap-4">
      <Switch
        className="flex flex-row items-center justify-between gap-2"
        isSelected={localEnabled}
        onChange={onEnabledChange}
      >
        Tunnel enabled
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>

      <Separator />

      {boundsReady && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <StepperField
              aria-label="Tunnel high price"
              group
              label="High"
              minValue={priceStep}
              prefix="$"
              step={priceStep}
              value={localHigh}
              valueClassName="mx-3 text-sm"
              onChange={onHighChange}
            />
            {priceToShow !== null && (
              <div className="text-right">
                <div className="font-mono text-[10px] tracking-[.14em] text-muted uppercase">Mark price</div>
                <NumberFlow
                  className="font-mono text-xl font-bold"
                  format={moneyFormatOptions(priceToShow)}
                  value={priceToShow}
                />
              </div>
            )}
          </div>

          <StepperField
            aria-label="Tunnel low price"
            group
            label="Low"
            minValue={priceStep}
            prefix="$"
            step={priceStep}
            value={localLow}
            valueClassName="mx-3 text-sm"
            onChange={onLowChange}
          />

          <StepperField
            aria-label="Tunnel amount"
            label="Amount"
            minValue={positionStep}
            step={positionStep}
            value={localSize}
            onChange={onSizeChange}
          />
        </div>
      )}

      <Separator />

      <TunnelSummary state={state} />
    </div>
  );
}

function TunnelSummary({ state }: { state: TenantState | null }) {
  if (!state) {
    return <div className="text-xs text-muted">Waiting for the first snapshot…</div>;
  }

  const tunnel = state.tunnel;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">Tunnel</span>
        <span className="flex items-center gap-2 font-mono font-semibold">
          {tunnel ? (
            <>
              <NumberFlow format={moneyFormatOptions(tunnel.low)} value={tunnel.low} />
              {" – "}
              <NumberFlow format={moneyFormatOptions(tunnel.high)} value={tunnel.high} />
            </>
          ) : (
            <span className="text-muted">Unset</span>
          )}
          <Chip color={tunnel?.enabled ? "success" : "default"} size="sm">
            {tunnel?.enabled ? "ON" : "OFF"}
          </Chip>
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">Buy @ low</span>
        {tunnel?.buy ? (
          <span className="font-mono">
            <NumberFlow value={tunnel.buy.size} /> @{" "}
            <NumberFlow format={moneyFormatOptions(tunnel.buy.limitPx)} value={tunnel.buy.limitPx} />
          </span>
        ) : (
          <span className="text-muted">None</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">Sell @ high</span>
        {tunnel?.sell ? (
          <span className="font-mono">
            <NumberFlow value={tunnel.sell.size} /> @{" "}
            <NumberFlow format={moneyFormatOptions(tunnel.sell.limitPx)} value={tunnel.sell.limitPx} />
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
