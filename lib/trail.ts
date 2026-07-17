export type TrailType = "pct" | "abs";

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
