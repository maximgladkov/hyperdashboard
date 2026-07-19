export type LiqOrder = { price: number; size: number };

export type LiqInput = {
  side: "buy" | "sell";
  mark: number;
  newOrderSize: number;
  newOrderPrice: number | null;
  existingSize: number;
  existingPositionValue: number;
  maxLeverage: number | null;
  crossAccountValue: number | null;
  crossMaintenanceMarginUsed: number | null;
  addOrders: LiqOrder[];
};

function candidateLiqPrice(priceRef: number, size: number, equity: number, maintOther: number, l: number): number | null {
  const sideSign = Math.sign(size);
  if (sideSign === 0) return null;
  const maintAtRef = maintOther + Math.abs(size) * priceRef * l;
  const marginAvailable = equity - maintAtRef;
  const denom = 1 - l * sideSign;
  if (denom === 0) return null;
  return priceRef - (sideSign * marginAvailable) / size / denom;
}

export function estimateLiquidationPrice(input: LiqInput): number | null {
  const {
    side,
    mark,
    newOrderSize,
    newOrderPrice,
    existingSize,
    existingPositionValue,
    maxLeverage,
    crossAccountValue,
    crossMaintenanceMarginUsed,
    addOrders,
  } = input;

  if (
    !maxLeverage ||
    maxLeverage <= 0 ||
    crossAccountValue == null ||
    crossMaintenanceMarginUsed == null ||
    !isFinite(mark) ||
    mark <= 0
  ) {
    return null;
  }

  const l = 1 / (2 * maxLeverage);
  const sideMul = side === "buy" ? 1 : -1;
  const maintOther = crossMaintenanceMarginUsed - existingPositionValue * l;

  const isMarket = newOrderPrice == null;
  const instantDelta = isMarket ? sideMul * newOrderSize : 0;

  let priceRef = mark;
  let size = existingSize + instantDelta;
  let equity = crossAccountValue;

  const breakpoints: { price: number; delta: number }[] = [];
  if (!isMarket && newOrderPrice != null) {
    breakpoints.push({ price: newOrderPrice, delta: sideMul * newOrderSize });
  }
  for (const o of addOrders) {
    if (o.size > 0 && isFinite(o.price)) breakpoints.push({ price: o.price, delta: sideMul * o.size });
  }

  breakpoints.sort((a, b) => (sideMul > 0 ? b.price - a.price : a.price - b.price));

  for (const bp of breakpoints) {
    if (size === 0) break;
    const candidate = candidateLiqPrice(priceRef, size, equity, maintOther, l);
    if (candidate == null) return null;
    const sideSign = Math.sign(size);
    const reachedFirst = sideSign > 0 ? candidate >= bp.price : candidate <= bp.price;
    if (reachedFirst) return candidate < 0 ? null : candidate;

    equity += size * (bp.price - priceRef);
    size += bp.delta;
    priceRef = bp.price;
  }

  if (size === 0) return null;
  const final = candidateLiqPrice(priceRef, size, equity, maintOther, l);
  if (final == null || final < 0) return null;
  return final;
}
