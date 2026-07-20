"use client";

import { useConfirm } from "@/components/ConfirmDialog";
import { StepperField } from "@/components/StepperField";
import { moneyFormatOptions, usd } from "@/lib/format";
import { fetchMaxLeverage, fetchOpenOrders } from "@/lib/hyperliquid";
import { estimateLiquidationPrice, type LiqOrder } from "@/lib/liquidation";
import { orderLabel, orderPrice } from "@/lib/orders";
import { cancelOrder, placeOrder } from "@/lib/trade";
import { useLeverage, usePositionStep, usePriceStep, useTradeSize } from "@/lib/tradeSteps";
import type { TenantState } from "@/lib/trail";
import type { ClearinghouseState, OpenOrder } from "@/lib/types";
import { useMarkPrice } from "@/lib/useMarkPrice";
import { NumberFlowInput } from "@daformat/react-number-flow-input";
import { NumberValue, Widget } from "@heroui-pro/react";
import type { ButtonProps } from "@heroui/react";
import { Button, ButtonGroup, Card, Description, Modal, toast, useOverlayState } from "@heroui/react";
import NumberFlow from "@number-flow/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const POSITION_POLL_MS = 3000;
const ORDERS_POLL_MS = 5000;
const DOUBLE_TAP_MS = 300;
const PIXELS_PER_STEP = 32;
const MAJOR_EVERY = 2;
const VIRTUAL_COUNT = 500_000;
const VIRTUAL_CENTER = VIRTUAL_COUNT / 2;
const RECENTER_MARGIN = 50_000;

function scrollTopForIndex(index: number): number {
  return index * PIXELS_PER_STEP + PIXELS_PER_STEP / 2;
}

function indexForScrollTop(scrollTop: number): number {
  return (scrollTop - PIXELS_PER_STEP / 2) / PIXELS_PER_STEP;
}

function formatTick(v: number, decimals: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatSize(n: number): string {
  return n.toFixed(4).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function ConfirmStat({
  label,
  value,
  currency = true,
  suffix,
  tone,
}: {
  label: string;
  value: number | null;
  currency?: boolean;
  suffix?: string;
  tone?: "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <span className="text-sm text-muted">{label}</span>
      {value == null ? (
        <span className="font-mono text-sm text-muted">&mdash;</span>
      ) : (
        <NumberValue
          className={`text-xl items-baseline tabular-nums ${tone === "danger" ? "text-danger" : "text-foreground"}`}
          currency={currency ? "USD" : undefined}
          maximumFractionDigits={currency ? (Math.abs(value) >= 1000 ? 0 : 2) : 4}
          style={currency ? "currency" : "decimal"}
          value={value}
        >
          {suffix && (
            <NumberValue.Suffix className="ml-2 text-sm text-muted leading-none">
              {suffix}
            </NumberValue.Suffix>
          )}
        </NumberValue>
      )}
    </div>
  );
}

function confirmBody({
  orderType,
  size,
  coin,
  price,
  isMarket,
  estimatedLiq,
}: {
  orderType: string;
  size: number;
  coin: string;
  price: number | null;
  isMarket: boolean;
  estimatedLiq: number | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Card variant="secondary" className="flex flex-col gap-0 p-0 divide-y">
        <ConfirmStat currency={false} label="Size" suffix={coin} value={size} />
        <ConfirmStat label={isMarket ? "Price (\u2248 mark)" : "Price"} value={price} />
        <ConfirmStat label="Est. liquidation" tone="danger" value={estimatedLiq} />
      </Card>
    </div>
  );
}

function formatCurrencyInput(raw: string): string {
  if (raw === "" || raw === ".") return raw;
  const [intPart, decPart] = raw.split(".");
  const grouped = (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${decPart !== undefined ? `${grouped}.${decPart}` : grouped}`;
}

const SUCCESS_BUTTON_STYLE = {
  "--button-bg": "var(--success)",
  "--button-bg-hover": "var(--success-hover)",
  "--button-bg-pressed": "var(--success-hover)",
  "--button-fg": "var(--success-foreground)",
  borderColor: "var(--success)",
} as CSSProperties;

type ActionButtonProps = Omit<ButtonProps, "variant"> & { variant?: ButtonProps["variant"] | "success" };

function ActionButton({ variant, style, ...props }: ActionButtonProps) {
  const isSuccess = variant === "success";
  return (
    <Button
      style={isSuccess ? { ...SUCCESS_BUTTON_STYLE, ...style } : style}
      variant={isSuccess ? "primary" : variant}
      {...props}
    />
  );
}

type TrailStateResponse = { managed: false } | { managed: true; state: TenantState | null } | { error: string };

async function fetchTrailState(address: string): Promise<TrailStateResponse> {
  const r = await fetch(`/api/trail/state?address=${address}`, { cache: "no-store" });
  return r.json();
}

export default function TradeWheel({
  coin,
  initialPrice,
  address,
  clearing,
}: {
  coin: string;
  initialPrice?: number;
  address?: string;
  clearing?: ClearinghouseState;
}) {
  const mark = useMarkPrice(coin, initialPrice ?? null);
  const [scrollValue, setScrollValue] = useState<number | null>(initialPrice ?? null);
  const [following, setFollowing] = useState(true);
  const [containerHeight, setContainerHeight] = useState(0);
  const [entryPx, setEntryPx] = useState<number | null>(null);
  const [stopPx, setStopPx] = useState<number | null>(null);
  const [positionSize, setPositionSize] = useState<number | null>(null);
  const [positionSide, setPositionSide] = useState<"long" | "short" | null>(null);
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [size, setSize] = useTradeSize();
  const [pending, setPending] = useState<"buy" | "sell" | null>(null);
  const [reducing, setReducing] = useState(false);
  const [sizeStep] = usePositionStep();
  const [priceStep] = usePriceStep();
  const priceDialog = useOverlayState();
  const [priceDraft, setPriceDraft] = useState<number | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const value = following ? mark : scrollValue;

  const scrollRef = useRef<HTMLDivElement>(null);
  const windowStartRef = useRef<number | null>(null);
  const lastTapRef = useRef(0);
  const prevCoinRef = useRef<string | null>(null);
  const prevStepRef = useRef<number | null>(null);

  useEffect(() => {
    if (!address) {
      setEntryPx(null);
      setStopPx(null);
      setPositionSize(null);
      setPositionSide(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetchTrailState(address);
        if (cancelled) return;
        const state = "managed" in res && res.managed ? res.state : null;
        if (!state || state.coin !== coin) {
          setEntryPx(null);
          setStopPx(null);
          setPositionSize(null);
          setPositionSide(null);
          return;
        }
        setEntryPx(state.position?.entryPx ?? null);
        setStopPx(state.stop?.triggerPx ?? null);
        setPositionSize(state.position?.size ?? null);
        setPositionSide(state.position?.side ?? null);
      } catch {
        setEntryPx(null);
        setStopPx(null);
        setPositionSize(null);
        setPositionSide(null);
      }
    };
    poll();
    const id = setInterval(poll, POSITION_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, coin]);

  useEffect(() => {
    if (!address) {
      setOrders([]);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      const list = await fetchOpenOrders(address);
      if (cancelled) return;
      setOrders(list.filter((o) => o.coin === coin && !o.isTrigger));
    };
    poll();
    const id = setInterval(poll, ORDERS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, coin]);

  const existingPosition = useMemo(
    () => clearing?.assetPositions?.find((p) => p.position.coin === coin)?.position ?? null,
    [clearing, coin]
  );

  const [fetchedMaxLeverage, setFetchedMaxLeverage] = useState<number | null>(null);

  useEffect(() => {
    if (existingPosition?.maxLeverage) return;
    let cancelled = false;
    fetchMaxLeverage(coin).then((lev) => {
      if (!cancelled) setFetchedMaxLeverage(lev);
    });
    return () => {
      cancelled = true;
    };
  }, [coin, existingPosition?.maxLeverage]);

  const isIsolated = existingPosition?.leverage?.type === "isolated";
  const maxLeverage = existingPosition?.maxLeverage ?? fetchedMaxLeverage;
  const [leverage] = useLeverage();

  const buyAddOrders = useMemo<LiqOrder[]>(
    () => orders.filter((o) => o.side === "B" && !o.reduceOnly).map((o) => ({ price: orderPrice(o), size: +o.sz })),
    [orders]
  );
  const sellAddOrders = useMemo<LiqOrder[]>(
    () => orders.filter((o) => o.side === "A" && !o.reduceOnly).map((o) => ({ price: orderPrice(o), size: +o.sz })),
    [orders]
  );

  const estimateLiqFor = useCallback(
    (orderSide: "buy" | "sell"): number | null => {
      if (isIsolated || mark == null) return null;
      const limitPrice = following ? null : value;
      return estimateLiquidationPrice({
        side: orderSide,
        mark,
        newOrderSize: size,
        newOrderPrice: limitPrice,
        leverage,
        maxLeverage,
        addOrders: orderSide === "buy" ? buyAddOrders : sellAddOrders,
      });
    },
    [isIsolated, mark, following, value, size, leverage, maxLeverage, buyAddOrders, sellAddOrders]
  );

  const estimatedLiqBuy = useMemo(() => estimateLiqFor("buy"), [estimateLiqFor]);
  const estimatedLiqSell = useMemo(() => estimateLiqFor("sell"), [estimateLiqFor]);

  const step = priceStep;

  // Content index ascends downward (native scroll order), but price ascends upward
  // (matching the mark/entry/stop/order line convention), so price = step * (windowStart - contentIndex).
  const scrollToPrice = useCallback((price: number, opts?: { smooth?: boolean }) => {
    const priceIndex = price / step;
    let start = windowStartRef.current;
    let contentIndex = start == null ? null : start - priceIndex;
    let recentered = false;
    if (
      start == null ||
      contentIndex == null ||
      contentIndex < RECENTER_MARGIN ||
      contentIndex > VIRTUAL_COUNT - RECENTER_MARGIN
    ) {
      start = VIRTUAL_CENTER + Math.round(priceIndex);
      windowStartRef.current = start;
      contentIndex = start - priceIndex;
      recentered = true;
    }
    const el = scrollRef.current;
    const top = scrollTopForIndex(contentIndex);
    if (el) {
      if (opts?.smooth && !recentered) el.scrollTo({ top, behavior: "smooth" });
      else el.scrollTop = top;
    }
    setScrollValue(price);
  }, [step]);

  const handleReset = useCallback(() => {
    setFollowing(true);
  }, []);

  const openPriceDialog = useCallback(() => {
    setPriceDraft(null);
    priceDialog.open();
  }, [priceDialog]);

  const confirmPrice = useCallback(() => {
    if (priceDraft != null) {
      setFollowing(false);
      scrollToPrice(priceDraft);
    }
    priceDialog.close();
  }, [priceDraft, priceDialog, scrollToPrice]);

  useEffect(() => {
    if (!following || mark == null) return;
    scrollToPrice(mark, { smooth: true });
  }, [following, mark, scrollToPrice]);

  useEffect(() => {
    const coinChanged = prevCoinRef.current !== coin;
    const stepChanged = prevStepRef.current !== step;
    prevCoinRef.current = coin;
    prevStepRef.current = step;
    if (!coinChanged && !stepChanged) return;
    windowStartRef.current = null;
    if (coinChanged) setFollowing(true);
    const reference =
      (coinChanged ? null : following ? mark : scrollValue) ?? mark ?? initialPrice ?? 0;
    scrollToPrice(reference);
    // Only re-run when the coin or step identity changes; reads latest mark/following/scrollValue from closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin, step]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerHeight(entries[0]?.contentRect.height ?? el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rafRef = useRef<number | null>(null);
  const [, forceTickRefresh] = useState(0);
  const handleScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = scrollRef.current;
      const start = windowStartRef.current;
      if (!el || start == null) return;
      const contentIndex = indexForScrollTop(el.scrollTop);
      setScrollValue((start - contentIndex) * step);
      if (contentIndex < RECENTER_MARGIN || contentIndex > VIRTUAL_COUNT - RECENTER_MARGIN) {
        const shift = Math.round(contentIndex - VIRTUAL_CENTER);
        if (shift !== 0) {
          windowStartRef.current = start - shift;
          el.scrollTop -= shift * PIXELS_PER_STEP;
          forceTickRefresh((n) => n + 1);
        }
      }
    });
  }, [step]);

  const suppressExitRef = useRef(false);

  const exitFollowing = useCallback(() => {
    if (suppressExitRef.current) {
      suppressExitRef.current = false;
      return;
    }
    if (following) setFollowing(false);
  }, [following]);

  const handleTapReset = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const now = e.timeStamp;
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        lastTapRef.current = 0;
        suppressExitRef.current = true;
        handleReset();
      } else {
        lastTapRef.current = now;
      }
    },
    [handleReset]
  );

  const virtualizer = useVirtualizer({
    count: VIRTUAL_COUNT,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => PIXELS_PER_STEP,
    overscan: 6,
    paddingStart: containerHeight / 2,
    paddingEnd: containerHeight / 2,
  });

  const submitOrder = useCallback(
    async (side: "buy" | "sell") => {
      if (!address || pending) return;
      const limitPrice = following ? null : value;
      const label = side === "buy" ? "Long" : "Short";
      setPending(side);
      try {
        const { order } = await placeOrder(address, { side, size, price: limitPrice });
        if (order.status === "resting") {
          toast.success(`${label} limit resting`, {
            description: `${formatSize(size)} ${coin} @ ${usd(limitPrice)}`,
          });
        } else {
          toast.success(`${label} filled`, {
            description: `${formatSize(order.filledSz)} ${coin} @ ${usd(order.avgPx)}`,
          });
        }
      } catch (err) {
        toast.danger("Order failed", { description: (err as Error).message });
      } finally {
        setPending(null);
      }
    },
    [address, pending, following, value, size, coin]
  );

  const reduceOrder = useMemo(() => orders.find((o) => o.reduceOnly) ?? null, [orders]);

  const submitReduceOnly = useCallback(async () => {
    if (!address || reducing || positionSide == null || positionSize == null) return;
    const side = positionSide === "long" ? "sell" : "buy";
    const reduceSize = Math.abs(positionSize);
    const limitPrice = following ? null : value;
    const moving = reduceOrder != null;
    setReducing(true);
    try {
      if (reduceOrder != null) {
        await cancelOrder(address, reduceOrder.oid);
        setOrders((prev) => prev.filter((o) => o.oid !== reduceOrder.oid));
      }
      const { order } = await placeOrder(address, { side, size: reduceSize, price: limitPrice, reduceOnly: true });
      if (order.status === "resting") {
        toast.success(moving ? "Reduce-only order moved" : "Reduce-only limit resting", {
          description: `${formatSize(reduceSize)} ${coin} @ ${usd(limitPrice)}`,
        });
      } else {
        toast.success("Position reduced", {
          description: `${formatSize(order.filledSz)} ${coin} @ ${usd(order.avgPx)}`,
        });
      }
    } catch (err) {
      toast.danger(moving ? "Reduce-only move failed" : "Reduce-only order failed", {
        description: (err as Error).message,
      });
    } finally {
      setReducing(false);
    }
  }, [address, reducing, positionSide, positionSize, following, value, coin, reduceOrder]);

  const hasPrice = value != null || mark != null;
  const effectiveValue = value ?? mark ?? 0;
  const isLong = mark == null || effectiveValue <= mark;
  const liquidationPx = existingPosition?.liquidationPx != null ? +existingPosition.liquidationPx : null;

  // Content-relative top (matches the virtualizer's own item.start + paddingStart), so lines
  // scroll natively with the ticks instead of chasing scroll-derived React state every frame.
  const windowStart = windowStartRef.current ?? 0;
  const halfHeight = containerHeight / 2;
  const contentTop = (price: number) => halfHeight + scrollTopForIndex(windowStart - price / step);

  const markTop = mark != null ? contentTop(mark) : null;
  const entryTop = entryPx != null ? contentTop(entryPx) : null;
  const stopTop = stopPx != null ? contentTop(stopPx) : null;
  const liqTop = liquidationPx != null ? contentTop(liquidationPx) : null;

  const orderLines =
    value == null
      ? []
      : orders
        .map((o) => {
          const px = orderPrice(o);
          if (!px) return null;
          const offset = ((value - px) / step) * PIXELS_PER_STEP;
          if (Math.abs(offset) > 260) return null;
          return { order: o, top: contentTop(px), px };
        })
        .filter((x): x is { order: OpenOrder; top: number; px: number } => x != null);

  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Trade &middot; {coin}</Widget.Title>
        <Widget.Description className="flex items-center gap-1 font-mono">
          Mark <NumberFlow format={moneyFormatOptions(mark ?? 0)} value={mark ?? 0} />
        </Widget.Description>
      </Widget.Header>
      <Widget.Content className="p-0">
        <div
          className="relative aspect-square min-h-[360px] w-full select-none overflow-hidden bg-surface"
          onPointerDown={handleTapReset}
          onTouchStart={exitFollowing}
          onWheel={exitFollowing}
        >
          <div
            ref={scrollRef}
            className="absolute inset-0 z-[1] overflow-x-hidden overflow-y-scroll overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)] [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
            onScroll={handleScroll}
          >
            <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((item) => {
                const absIndex = windowStart - item.index;
                const tickValue = absIndex * step;
                const major = absIndex % MAJOR_EVERY === 0;
                return (
                  <div
                    key={item.key}
                    className="absolute inset-x-0 top-0 flex items-center justify-end gap-1.5"
                    style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                  >
                    {major && (
                      <span className="font-mono text-[10px] tabular-nums text-muted">
                        {formatTick(tickValue, 0)}
                      </span>
                    )}
                    <span className={major ? "h-[2px] w-4 bg-foreground/50" : "h-px w-2.5 bg-foreground/25"} />
                  </div>
                );
              })}

              {!following && markTop != null && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[5] border-t border-dashed border-accent/60"
                  style={{ top: markTop }}
                >
                  <span className="absolute right-16 flex -translate-y-1/2 items-center gap-1 rounded-full bg-accent px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-accent-foreground">
                    MARK <span className="tabular-nums">{usd(mark)}</span>
                  </span>
                </div>
              )}

              {entryTop != null && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[4] border-t border-dashed border-sky-400/60"
                  style={{ top: entryTop }}
                >
                  <span className="absolute right-16 flex -translate-y-1/2 items-center gap-1 rounded-full bg-sky-400 px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-black">
                    ENTRY
                    {positionSize != null && <span className="tabular-nums">{formatSize(positionSize)}</span>}
                    @ <span className="tabular-nums">{usd(entryPx)}</span>
                  </span>
                </div>
              )}

              {stopTop != null && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[4] border-t border-dashed border-danger/70"
                  style={{ top: stopTop }}
                >
                  <span className="absolute right-16 flex -translate-y-1/2 items-center gap-1 rounded-full bg-danger px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-danger-foreground">
                    STOP
                    {positionSize != null && <span className="tabular-nums">{formatSize(positionSize)}</span>}
                    @ <span className="tabular-nums">{usd(stopPx)}</span>
                  </span>
                </div>
              )}

              {liqTop != null && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[4] border-t-2 border-solid border-red-600"
                  style={{ top: liqTop }}
                >
                  <span className="absolute right-16 flex -translate-y-1/2 items-center gap-1 rounded-full bg-red-600 px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-white">
                    LIQ <span className="tabular-nums">{usd(liquidationPx)}</span>
                  </span>
                </div>
              )}

              {orderLines.map(({ order, top, px }) => {
                const isBuy = order.side === "B";
                return (
                  <div
                    key={order.oid}
                    className={`pointer-events-none absolute inset-x-0 z-[3] border-t border-dashed ${isBuy ? "border-cyan-400/60" : "border-orange-400/60"}`}
                    style={{ top }}
                  >
                    <span
                      className={`absolute right-16 flex -translate-y-1/2 items-center gap-1 rounded-full px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-black ${isBuy ? "bg-cyan-400" : "bg-orange-400"}`}
                    >
                      {isBuy ? "BUY" : "SELL"} {orderLabel(order)}
                      <span className="tabular-nums">{formatSize(+order.sz)}</span>
                      @ <span className="tabular-nums">{usd(px)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-white/30" />

          {hasPrice && (
            <div className="absolute top-1/2 left-4 z-10 -translate-y-1/2" onPointerDown={(e) => e.stopPropagation()}>
              <button
                aria-label="Set limit price"
                className={`flex cursor-pointer items-center justify-center rounded-full px-3 py-0 shadow-field outline-none transition-colors ${following ? "bg-accent" : "bg-black/50"}`}
                type="button"
                onClick={openPriceDialog}
              >
                <NumberFlow
                  className="text-3xl font-bold tabular-nums text-foreground"
                  format={moneyFormatOptions(effectiveValue)}
                  value={effectiveValue}
                />
              </button>
            </div>
          )}

          <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <StepperField
              aria-label="Position size"
              label={`Position size · ${coin}`}
              minValue={sizeStep}
              step={sizeStep}
              suffix={` ${coin}`}
              value={size}
              valueClassName="text-xs"
              onChange={setSize}
            />
            {positionSize != null && positionSide != null && (
              <ActionButton
                aria-label={reduceOrder ? "Move reduce-only order to selected price" : "Reduce-only order matching position size"}
                className="font-mono text-[11px]"
                isDisabled={!address || reducing}
                isPending={reducing}
                size="sm"
                variant="danger"
                onPress={() =>
                  confirm(submitReduceOnly, {
                    title: reduceOrder ? "Move reduce-only order" : "Reduce position",
                    body: `${reduceOrder ? "Move" : "Place"} a reduce-only order for ${formatSize(Math.abs(positionSize))} ${coin}${following ? " at market" : ` @ ${usd(value)}`}.`,
                    confirmLabel: reduceOrder ? "Move" : "Reduce",
                    confirmVariant: "danger",
                  })
                }
              >
                {reduceOrder ? "Move" : "Reduce"} {formatSize(Math.abs(positionSize))} {coin}
              </ActionButton>
            )}
          </div>

          <div className="absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2" onPointerDown={(e) => e.stopPropagation()}>
            {following ? (
              <ButtonGroup fullWidth size="lg">
                <ActionButton
                  variant="success"
                  isDisabled={!address || (pending != null && pending !== "buy")}
                  isPending={pending === "buy"}
                  onPress={() =>
                    confirm(() => submitOrder("buy"), {
                      title: "Confirm long",
                      body: confirmBody({
                        orderType: "Market order",
                        size,
                        coin,
                        price: mark,
                        isMarket: true,
                        estimatedLiq: estimatedLiqBuy,
                      }),
                      confirmLabel: "Long",
                      confirmVariant: "success",
                    })
                  }
                >
                  Long
                </ActionButton>
                <ActionButton
                  variant="danger"
                  isDisabled={!address || (pending != null && pending !== "sell")}
                  isPending={pending === "sell"}
                  onPress={() =>
                    confirm(() => submitOrder("sell"), {
                      title: "Confirm short",
                      body: confirmBody({
                        orderType: "Market order",
                        size,
                        coin,
                        price: mark,
                        isMarket: true,
                        estimatedLiq: estimatedLiqSell,
                      }),
                      confirmLabel: "Short",
                      confirmVariant: "danger",
                    })
                  }
                >
                  <ButtonGroup.Separator />
                  Short
                </ActionButton>
              </ButtonGroup>
            ) : (
              <ActionButton
                fullWidth
                size="lg"
                variant={isLong ? "success" : "danger"}
                isDisabled={!address || pending != null}
                isPending={pending === (isLong ? "buy" : "sell")}
                onPress={() =>
                  confirm(() => submitOrder(isLong ? "buy" : "sell"), {
                    title: isLong ? "Confirm long" : "Confirm short",
                    body: confirmBody({
                      orderType: "Limit order",
                      size,
                      coin,
                      price: value,
                      isMarket: false,
                      estimatedLiq: isLong ? estimatedLiqBuy : estimatedLiqSell,
                    }),
                    confirmLabel: isLong ? "Long" : "Short",
                    confirmVariant: isLong ? "success" : "danger",
                  })
                }
              >
                {isLong ? "Long" : "Short"} @ {usd(value)}
              </ActionButton>
            )}
          </div>
        </div>
      </Widget.Content>

      <Modal.Backdrop isOpen={priceDialog.isOpen} onOpenChange={priceDialog.setOpen}>
        <Modal.Container size="xs">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Move to price</Modal.Heading>
            </Modal.Header>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                confirmPrice();
              }}
            >
              <Modal.Body className="flex flex-col items-start justify-center gap-3 pt-4">
                <NumberFlowInput
                  autoFocus
                  className="text-foreground text-3xl font-bold tabular-nums outline-none"
                  decimalScale={0}
                  format={formatCurrencyInput}
                  isAllowed={(v) => v == null || v >= 0}
                  placeholder={usd(effectiveValue)}
                  value={priceDraft ?? ""}
                  onChange={(v) => setPriceDraft(v ?? null)}
                />
                <Description>Mark {usd(mark ?? 0)}</Description>
              </Modal.Body>
              <Modal.Footer>
                <Button fullWidth type="submit" variant="primary">
                  Move
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {confirmDialog}
    </Widget>
  );
}
