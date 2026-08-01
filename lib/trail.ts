export type TrailType = "pct" | "abs";

export interface TunnelOrderState {
  orderId: number;
  limitPx: number;
  size: number;
}

export interface TunnelState {
  enabled: boolean;
  low: number;
  high: number;
  size: number;
  buy: TunnelOrderState | null;
  sell: TunnelOrderState | null;
}

export interface TenantState {
  address: string;
  coin: string;
  price: number;
  position: {
    side: "long" | "short";
    size: number;
    entryPx: number;
  } | null;
  stop: {
    triggerPx: number;
    orderId: number;
  } | null;
  trail: {
    type: TrailType;
    value: number;
    enabled: boolean;
  };
  tunnel?: TunnelState | null;
  lastAction: string;
  updatedAt: string;
}

export type TrailConfigInput = {
  type?: unknown;
  value?: unknown;
  enabled?: unknown;
};

export type TrailConfigWrite = {
  type?: TrailType;
  value?: number;
  enabled?: boolean;
};

export type TunnelConfigInput = {
  enabled?: unknown;
  low?: unknown;
  high?: unknown;
  size?: unknown;
};

export type TunnelConfigWrite = {
  enabled?: boolean;
  low?: number;
  high?: number;
  size?: number;
};

export function parseEnabled(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "on", "yes"].includes(s)) return true;
  if (["false", "0", "off", "no"].includes(s)) return false;
  return undefined;
}

export function isTrailType(v: unknown): v is TrailType {
  return v === "pct" || v === "abs";
}

export function validateConfig(
  input: TrailConfigInput,
  effectiveType: TrailType
): { ok: TrailConfigWrite; errors: string[] } {
  const ok: TrailConfigWrite = {};
  const errors: string[] = [];

  if (input.type !== undefined) {
    if (isTrailType(input.type)) ok.type = input.type;
    else errors.push(`type must be "pct" or "abs"`);
  }

  if (input.value !== undefined) {
    const n = Number(input.value);
    const type = ok.type ?? effectiveType;
    if (!Number.isFinite(n) || n <= 0) errors.push("value must be a positive number");
    else if (type === "pct" && n >= 1) errors.push("value must be < 1 when type is pct");
    else ok.value = n;
  }

  if (input.enabled !== undefined) {
    const b = parseEnabled(input.enabled);
    if (b === undefined) errors.push("enabled must be a recognizable boolean");
    else ok.enabled = b;
  }

  return { ok, errors };
}

export function validateTunnelConfig(input: TunnelConfigInput): {
  ok: TunnelConfigWrite;
  errors: string[];
} {
  const ok: TunnelConfigWrite = {};
  const errors: string[] = [];

  if (input.enabled !== undefined) {
    const b = parseEnabled(input.enabled);
    if (b === undefined) errors.push("enabled must be a recognizable boolean");
    else ok.enabled = b;
  }

  if (input.low !== undefined) {
    const n = Number(input.low);
    if (!Number.isFinite(n) || n <= 0) errors.push("low must be a positive number");
    else ok.low = n;
  }

  if (input.high !== undefined) {
    const n = Number(input.high);
    if (!Number.isFinite(n) || n <= 0) errors.push("high must be a positive number");
    else ok.high = n;
  }

  if (input.size !== undefined) {
    const n = Number(input.size);
    if (!Number.isFinite(n) || n <= 0) errors.push("size must be a positive number");
    else ok.size = n;
  }

  if (ok.low !== undefined && ok.high !== undefined && ok.high <= ok.low) {
    errors.push("high must be greater than low");
  }

  return { ok, errors };
}
