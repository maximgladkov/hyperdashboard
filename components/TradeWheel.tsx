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
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const POSITION_POLL_MS = 3000;
const ORDERS_POLL_MS = 5000;
const DOUBLE_TAP_MS = 300;
const PIXELS_PER_STEP = 32;
const RULER_TICKS = 28;
const MAJOR_EVERY = 2;
const RULER_WIDTH_PX = 64;

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
            <NumberValue.Suffix className="ml-1 text-sm text-muted leading-none">
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

type DragState = { startY: number; startValue: number };

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
  const [heldValue, setHeldValue] = useState<number | null>(initialPrice ?? null);
  const [following, setFollowing] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
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

  const value = following ? mark : heldValue;

  const dragRef = useRef<DragState | null>(null);
  const lastTapRef = useRef(0);

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

  const handleReset = useCallback(() => {
    setFollowing(true);
    if (mark != null) setHeldValue(mark);
  }, [mark]);

  const openPriceDialog = useCallback(() => {
    setPriceDraft(null);
    priceDialog.open();
  }, [priceDialog]);

  const confirmPrice = useCallback(() => {
    if (priceDraft != null) {
      setFollowing(false);
      setHeldValue(priceDraft);
    }
    priceDialog.close();
  }, [priceDraft, priceDialog]);

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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const now = e.timeStamp;
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        lastTapRef.current = 0;
        handleReset();
        return;
      }
      lastTapRef.current = now;
      e.currentTarget.setPointerCapture(e.pointerId);
      setFollowing(false);
      setIsDragging(true);
      dragRef.current = {
        startY: e.clientY,
        startValue: value ?? mark ?? 0,
      };
    },
    [value, mark, handleReset]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dyTotal = e.clientY - drag.startY;
      setHeldValue(drag.startValue + (dyTotal / PIXELS_PER_STEP) * step);
    },
    [step]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  const centerIndex = value != null ? Math.round(value / step) : 0;
  const ticks = useMemo(() => {
    const arr: { idx: number; tickValue: number; major: boolean }[] = [];
    for (let k = -RULER_TICKS; k <= RULER_TICKS; k++) {
      const idx = centerIndex + k;
      arr.push({ idx, tickValue: idx * step, major: idx % MAJOR_EVERY === 0 });
    }
    return arr;
  }, [centerIndex, step]);

  const effectiveValue = value ?? mark ?? 0;
  const isLong = mark == null || effectiveValue <= mark;
  const markOffset = mark != null && value != null ? ((value - mark) / step) * PIXELS_PER_STEP : 0;
  const entryOffset = entryPx != null && value != null ? ((value - entryPx) / step) * PIXELS_PER_STEP : null;
  const stopOffset = stopPx != null && value != null ? ((value - stopPx) / step) * PIXELS_PER_STEP : null;
  const liquidationPx = existingPosition?.liquidationPx != null ? +existingPosition.liquidationPx : null;
  const liqOffset = liquidationPx != null && value != null ? ((value - liquidationPx) / step) * PIXELS_PER_STEP : null;

  const orderLines = useMemo(() => {
    if (value == null) return [];
    return orders
      .map((o) => {
        const px = orderPrice(o);
        if (!px) return null;
        const offset = ((value - px) / step) * PIXELS_PER_STEP;
        if (Math.abs(offset) > 260) return null;
        return { order: o, offset, px };
      })
      .filter((x): x is { order: OpenOrder; offset: number; px: number } => x != null);
  }, [orders, value, step]);

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
          className={`relative aspect-square min-h-[360px] w-full touch-none select-none overflow-hidden bg-surface ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-white/30" />

          {!following && mark != null && value != null && (
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2 z-[5] border-t border-dashed border-accent/60"
              style={{
                transform: `translateY(${markOffset}px)`,
                transition: isDragging ? "none" : "transform 300ms ease-out",
              }}
            >
              <span className="absolute right-16 flex -translate-y-1/2 items-center gap-1 rounded-full bg-accent px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-accent-foreground">
                MARK <span className="tabular-nums">{usd(mark)}</span>
              </span>
            </div>
          )}

          {entryOffset != null && (
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2 z-[4] border-t border-dashed border-sky-400/60"
              style={{
                transform: `translateY(${entryOffset}px)`,
                transition: isDragging ? "none" : "transform 300ms ease-out",
              }}
            >
              <span className="absolute right-16 flex -translate-y-1/2 items-center gap-1 rounded-full bg-sky-400 px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-black">
                ENTRY
                {positionSize != null && <span className="tabular-nums">{formatSize(positionSize)}</span>}
                @ <span className="tabular-nums">{usd(entryPx)}</span>
              </span>
            </div>
          )}

          {stopOffset != null && (
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2 z-[4] border-t border-dashed border-danger/70"
              style={{
                transform: `translateY(${stopOffset}px)`,
                transition: isDragging ? "none" : "transform 300ms ease-out",
              }}
            >
              <span className="absolute right-16 flex -translate-y-1/2 items-center gap-1 rounded-full bg-danger px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-danger-foreground">
                STOP
                {positionSize != null && <span className="tabular-nums">{formatSize(positionSize)}</span>}
                @ <span className="tabular-nums">{usd(stopPx)}</span>
              </span>
            </div>
          )}

          {liqOffset != null && (
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2 z-[4] border-t-2 border-solid border-red-600"
              style={{
                transform: `translateY(${liqOffset}px)`,
                transition: isDragging ? "none" : "transform 300ms ease-out",
              }}
            >
              <span className="absolute right-16 flex -translate-y-1/2 items-center gap-1 rounded-full bg-red-600 px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-white">
                LIQ <span className="tabular-nums">{usd(liquidationPx)}</span>
              </span>
            </div>
          )}

          {orderLines.map(({ order, offset, px }) => {
            const isBuy = order.side === "B";
            return (
              <div
                key={order.oid}
                className={`pointer-events-none absolute inset-x-0 top-1/2 z-[3] border-t border-dashed ${isBuy ? "border-cyan-400/60" : "border-orange-400/60"}`}
                style={{
                  transform: `translateY(${offset}px)`,
                  transition: isDragging ? "none" : "transform 300ms ease-out",
                }}
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

          <div
            className="pointer-events-none absolute inset-y-0 right-0 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
            style={{ width: RULER_WIDTH_PX }}
          >
            {ticks.map(({ idx, tickValue, major }) => {
              const offset = value == null ? 0 : ((value - tickValue) / step) * PIXELS_PER_STEP;
              if (Math.abs(offset) > 260) return null;
              return (
                <div
                  key={idx}
                  className="absolute right-0 top-1/2 flex items-center justify-end gap-1.5"
                  style={{
                    transform: `translateY(calc(-50% + ${offset}px))`,
                    transition: isDragging ? "none" : "transform 300ms ease-out",
                  }}
                >
                  {major && (
                    <span className="font-mono text-[10px] tabular-nums text-muted">{formatTick(tickValue, 0)}</span>
                  )}
                  <span className={major ? "h-[2px] w-4 bg-foreground/50" : "h-px w-2.5 bg-foreground/25"} />
                </div>
              );
            })}
          </div>

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
              <Modal.Heading>Limit price · {coin}</Modal.Heading>
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
                <Button slot="close" type="button" variant="secondary">
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Confirm
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
