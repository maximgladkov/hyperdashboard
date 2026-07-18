import type { OpenOrder } from "./types";

export function orderPrice(o: OpenOrder): number {
  return o.isTrigger && o.triggerPx ? +o.triggerPx : +o.limitPx;
}

export function orderLabel(o: OpenOrder): string {
  if (o.isTrigger) {
    const cond = o.triggerCondition?.toLowerCase() ?? "";
    if (cond.includes("above") || cond.includes("take")) return "TP";
    if (cond.includes("below") || cond.includes("stop")) return "SL";
  }
  return o.orderType;
}
