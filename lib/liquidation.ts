export type LiqOrder = { price: number; size: number };

export type LiqInput = {
  side: "buy" | "sell";
  mark: number;
  newOrderSize: number;
  newOrderPrice: number | null;
  leverage: number;
  maxLeverage: number | null;
  addOrders: LiqOrder[];
};

function candidateLiqPrice(size: number, notionalSum: number, leverage: number, l: number): number | null {
  const sideSign = Math.sign(size);
  if (sideSign === 0) return null;
  const absSize = Math.abs(size);
  const denom = absSize * (sideSign - l * sideSign);
  if (denom === 0) return null;
  const price = (notionalSum * (sideSign - 1 / leverage)) / denom;
  if (!isFinite(price) || price < 0) return null;
  return price;
}

export function estimateLiquidationPrice(input: LiqInput): number | null {
  const { side, mark, newOrderSize, newOrderPrice, leverage, maxLeverage, addOrders } = input;

  if (!maxLeverage || maxLeverage <= 0 || !leverage || leverage <= 0 || !isFinite(mark) || mark <= 0) {
    return null;
  }

  const l = 1 / (2 * maxLeverage);
  const sideSign = side === "buy" ? 1 : -1;

  // Matches Hyperliquid's own order-ticket preview: the projected liquidation price is
  // computed for this order (plus the resting ladder behind it) as a fresh position at
  // the selected leverage, independent of any position already held in this coin.
  let size = 0;
  let notionalSum = 0;

  const isMarket = newOrderPrice == null;
  if (isMarket) {
    size += sideSign * newOrderSize;
    notionalSum += newOrderSize * mark;
  }

  const breakpoints: { price: number; size: number }[] = [];
  if (!isMarket && newOrderPrice != null) {
    breakpoints.push({ price: newOrderPrice, size: newOrderSize });
  }
  for (const o of addOrders) {
    if (o.size > 0 && isFinite(o.price)) breakpoints.push({ price: o.price, size: o.size });
  }

  breakpoints.sort((a, b) => (sideSign > 0 ? b.price - a.price : a.price - b.price));

  for (const bp of breakpoints) {
    if (size !== 0) {
      const candidate = candidateLiqPrice(size, notionalSum, leverage, l);
      if (candidate == null) return null;
      const reachedFirst = sideSign > 0 ? candidate >= bp.price : candidate <= bp.price;
      if (reachedFirst) return candidate;
    }

    size += sideSign * bp.size;
    notionalSum += bp.size * bp.price;
  }

  if (size === 0) return null;
  return candidateLiqPrice(size, notionalSum, leverage, l);
}
