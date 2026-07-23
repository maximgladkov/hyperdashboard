"use client";

import { fetchCandles, type Candle } from "@/lib/hyperliquid";
import type { RefObject } from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";

type Sample = { t: number; p: number };

export type TracePeriod = "1m" | "5m" | "15m" | "1h" | "1d";

export const TRACE_PERIODS: {
  id: TracePeriod;
  label: string;
  windowMs: number;
  candle: "1m" | "5m" | "15m" | "1h";
  anchorMs: number;
}[] = [
  { id: "1m", label: "1m", windowMs: 5 * 60_000, candle: "1m", anchorMs: 60_000 },
  { id: "5m", label: "5m", windowMs: 5 * 300_000, candle: "1m", anchorMs: 300_000 },
  { id: "15m", label: "15m", windowMs: 5 * 900_000, candle: "5m", anchorMs: 900_000 },
  { id: "1h", label: "1h", windowMs: 5 * 3_600_000, candle: "15m", anchorMs: 3_600_000 },
  { id: "1d", label: "1d", windowMs: 5 * 86_400_000, candle: "1h", anchorMs: 86_400_000 },
];

export const DEFAULT_TRACE_PERIOD: TracePeriod = "5m";
const TRACE_PERIOD_KEY = "hd.tracePeriod";

function isTracePeriod(v: string): v is TracePeriod {
  return TRACE_PERIODS.some((p) => p.id === v);
}

let periodValue: TracePeriod = DEFAULT_TRACE_PERIOD;
let periodHydrated = false;
const periodListeners = new Set<() => void>();

function hydratePeriod(): void {
  if (periodHydrated) return;
  periodHydrated = true;
  try {
    const raw = localStorage.getItem(TRACE_PERIOD_KEY);
    if (raw && isTracePeriod(raw)) periodValue = raw;
  } catch {}
}

function getTracePeriodSelection(): TracePeriod {
  hydratePeriod();
  return periodValue;
}

function setTracePeriodSelection(next: TracePeriod): void {
  if (!isTracePeriod(next)) return;
  hydratePeriod();
  if (next === periodValue) return;
  periodValue = next;
  try {
    localStorage.setItem(TRACE_PERIOD_KEY, next);
  } catch {}
  periodListeners.forEach((l) => l());
}

function subscribeTracePeriod(listener: () => void): () => void {
  periodListeners.add(listener);
  return () => {
    periodListeners.delete(listener);
  };
}

export function useTracePeriod(): [TracePeriod, (next: TracePeriod) => void] {
  const period = useSyncExternalStore(subscribeTracePeriod, getTracePeriodSelection, () => DEFAULT_TRACE_PERIOD);
  return [period, setTracePeriodSelection];
}

export function getTracePeriod(id: TracePeriod) {
  return TRACE_PERIODS.find((p) => p.id === id) ?? TRACE_PERIODS[1];
}

const LINE_WIDTH = 2.5;
const SEPARATOR_WIDTH = 3;
const FADE_START = 0.55;
const MIN_POINT_GAP_PX = 2;
const OVERDRAW_PX = 48;
const BAND_PAD_PX = 16;
const TRIANGLE_WIDTH = 14;
const RIGHT_EDGE_INSET = TRIANGLE_WIDTH;

function trimBufferMs(windowMs: number, anchorMs: number) {
  return Math.max(120_000, anchorMs * 2, Math.round(windowMs * 0.05));
}

function strokeSmooth(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n === 0) return;
  if (n === 1) {
    ctx.moveTo(pts[0].x, pts[0].y);
    return;
  }
  if (n === 2) {
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    return;
  }

  const dx = new Array<number>(n - 1);
  const slope = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    slope[i] = dx[i] !== 0 ? (pts[i + 1].y - pts[i].y) / dx[i] : 0;
  }

  const tangents = new Array<number>(n);
  tangents[0] = slope[0];
  tangents[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangents[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slope[i]) < 1e-12) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slope[i];
    const b = tangents[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      tangents[i] = t * a * slope[i];
      tangents[i + 1] = t * b * slope[i];
    }
  }

  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const h = dx[i];
    if (h <= 0) {
      ctx.lineTo(p1.x, p1.y);
      continue;
    }
    ctx.bezierCurveTo(
      p0.x + h / 3,
      p0.y + (tangents[i] * h) / 3,
      p1.x - h / 3,
      p1.y - (tangents[i + 1] * h) / 3,
      p1.x,
      p1.y
    );
  }
}

function pushPoint(pts: { x: number; y: number }[], x: number, y: number) {
  const last = pts[pts.length - 1];
  if (last && x - last.x < MIN_POINT_GAP_PX) {
    last.x = Math.max(last.x, x);
    last.y = y;
    return;
  }
  pts.push({ x, y });
}

function candlesToSamples(candles: Candle[]): Sample[] {
  const seeded: Sample[] = [];
  for (const c of candles) {
    const close = +c.c;
    if (Number.isFinite(close)) seeded.push({ t: c.T, p: close });
  }
  return seeded;
}

export function PriceTrace({
  coin,
  height,
  mark,
  pixelsPerStep,
  scrollRef,
  step,
  period,
  windowStartRef,
}: {
  coin: string;
  height: number;
  mark: number | null;
  pixelsPerStep: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  step: number;
  period: TracePeriod;
  windowStartRef: RefObject<number | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef<Sample[]>([]);
  const markRef = useRef(mark);
  const widthRef = useRef(0);
  const dprRef = useRef(1);
  const periodCfg = getTracePeriod(period);
  const paramsRef = useRef({
    height,
    step,
    pixelsPerStep,
    windowMs: periodCfg.windowMs,
    anchorMs: periodCfg.anchorMs,
  });

  markRef.current = mark;
  paramsRef.current = {
    height,
    step,
    pixelsPerStep,
    windowMs: periodCfg.windowMs,
    anchorMs: periodCfg.anchorMs,
  };

  useEffect(() => {
    let cancelled = false;
    samplesRef.current = [];
    const { windowMs, candle } = getTracePeriod(period);
    const buffer = trimBufferMs(windowMs, getTracePeriod(period).anchorMs);
    const end = Date.now();
    const start = end - windowMs - buffer;
    fetchCandles(coin, candle, start, end).then((candles) => {
      if (cancelled) return;
      const seeded = candlesToSamples(candles);
      const live = samplesRef.current;
      const lastHist = seeded[seeded.length - 1]?.t ?? 0;
      samplesRef.current = seeded.concat(live.filter((s) => s.t > lastHist));
    });

    return () => {
      cancelled = true;
    };
  }, [coin, period]);

  useEffect(() => {
    if (mark == null || !Number.isFinite(mark)) return;
    const now = Date.now();
    const samples = samplesRef.current;
    const last = samples[samples.length - 1];
    if (last && last.p === mark && now - last.t < 16) return;
    samples.push({ t: now, p: mark });
    const { windowMs, anchorMs } = getTracePeriod(period);
    const cutoff = now - windowMs - trimBufferMs(windowMs, anchorMs);
    let i = 0;
    while (i < samples.length && samples[i].t < cutoff) i++;
    if (i > 0) samples.splice(0, i);
  }, [mark, period]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const resize = () => {
      widthRef.current = scrollEl.clientWidth;
      dprRef.current = window.devicePixelRatio || 1;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(scrollEl);
    return () => ro.disconnect();
  }, [scrollRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const cs = getComputedStyle(canvas);
    const root = getComputedStyle(document.documentElement);
    const stroke = cs.getPropertyValue("--accent").trim() || root.getPropertyValue("--accent").trim() || "#7aa2ff";
    const separator =
      cs.getPropertyValue("--surface").trim() ||
      root.getPropertyValue("--surface").trim() ||
      cs.backgroundColor ||
      "#0a0a0a";

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = widthRef.current;
      const dpr = dprRef.current;
      if (w <= 0) return;

      const { height: halfHeight, step: priceStep, pixelsPerStep: pps, windowMs: win, anchorMs } =
        paramsRef.current;
      const windowStart = windowStartRef.current;
      if (windowStart == null || halfHeight <= 0 || priceStep <= 0) {
        canvas.style.visibility = "hidden";
        return;
      }

      const now = Date.now();
      const rightX = Math.max(1, w - RIGHT_EDGE_INSET);
      const pxPerMs = rightX / win;
      const samples = samplesRef.current;
      const live = markRef.current;

      const contentY = (p: number) => halfHeight + (windowStart - p / priceStep) * pps + pps / 2;

      const drawCutoff = now - win - OVERDRAW_PX / pxPerMs;
      const pts: { x: number; y: number }[] = [];
      let startIdx = 0;
      for (let i = 0; i < samples.length; i++) {
        if (samples[i].t >= drawCutoff) {
          startIdx = Math.max(0, i - 1);
          break;
        }
        startIdx = i;
      }
      for (let i = startIdx; i < samples.length; i++) {
        const s = samples[i];
        pushPoint(pts, rightX - (now - s.t) * pxPerMs, contentY(s.p));
      }
      if (live != null && Number.isFinite(live)) {
        pushPoint(pts, rightX, contentY(live));
      }
      if (pts.length === 0) {
        canvas.style.visibility = "hidden";
        return;
      }

      let minY = pts[0].y;
      let maxY = pts[0].y;
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].y < minY) minY = pts[i].y;
        if (pts[i].y > maxY) maxY = pts[i].y;
      }
      const bandTop = minY - BAND_PAD_PX;
      const bandH = Math.max(1, maxY - minY + BAND_PAD_PX * 2);

      canvas.style.visibility = "visible";
      canvas.style.top = `${bandTop}px`;
      canvas.style.left = `-${OVERDRAW_PX}px`;
      canvas.style.width = `${w + OVERDRAW_PX}px`;
      canvas.style.height = `${bandH}px`;
      canvas.width = Math.max(1, Math.round((w + OVERDRAW_PX) * dpr));
      canvas.height = Math.max(1, Math.round(bandH * dpr));

      for (let i = 0; i < pts.length; i++) pts[i].y -= bandTop;

      ctx.setTransform(dpr, 0, 0, dpr, OVERDRAW_PX * dpr, 0);
      ctx.clearRect(-OVERDRAW_PX, 0, w + OVERDRAW_PX, bandH);

      ctx.save();
      ctx.beginPath();
      ctx.rect(-OVERDRAW_PX, 0, rightX + OVERDRAW_PX, bandH);
      ctx.clip();

      ctx.beginPath();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineJoin = "round";
      ctx.lineCap = "butt";
      strokeSmooth(ctx, pts);
      ctx.stroke();
      ctx.restore();

      const windowStartT = now - win;
      const firstAnchor = Math.ceil(windowStartT / anchorMs) * anchorMs;
      ctx.fillStyle = separator;
      for (let t = firstAnchor; t < now; t += anchorMs) {
        const x = rightX - (now - t) * pxPerMs;
        if (x < -OVERDRAW_PX || x > rightX) continue;
        ctx.fillRect(x - SEPARATOR_WIDTH / 2, 0, SEPARATOR_WIDTH, bandH);
      }

      const fade = `linear-gradient(to right, black 0%, black ${FADE_START * 100}%, rgba(0,0,0,0.35) 82%, transparent 100%)`;
      canvas.style.setProperty("mask-image", fade);
      canvas.style.setProperty("-webkit-mask-image", fade);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scrollRef, windowStartRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute z-0"
      style={{ visibility: "hidden" }}
    />
  );
}
