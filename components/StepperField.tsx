"use client";

import { NumberFlowInput } from "@daformat/react-number-flow-input";
import { NumberStepper } from "@heroui-pro/react";
import { Button, Description, Modal, useOverlayState } from "@heroui/react";
import { useState } from "react";

export function decimalsForStep(step: number): number {
  if (!step || step >= 1) return 0;
  return Math.max(0, Math.round(Math.log10(1 / step)));
}

export function roundToStep(value: number, step: number, minValue?: number, maxValue?: number): number {
  const decimals = decimalsForStep(step);
  const base = minValue ?? 0;
  let next = Number((base + Math.round((value - base) / step) * step).toFixed(decimals));
  if (minValue != null) next = Math.max(minValue, next);
  if (maxValue != null) next = Math.min(maxValue, next);
  return Number(next.toFixed(decimals));
}

function buildRawFormatter(prefix: string, suffix: string, group: boolean) {
  return (raw: string) => {
    if (raw === "") return raw;
    const neg = raw.startsWith("-");
    const body = neg ? raw.slice(1) : raw;
    const [intPart, decPart] = body.split(".");
    const grouped = group ? (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",") : intPart || "";
    const num = decPart !== undefined ? `${grouped}.${decPart}` : grouped;
    return `${neg ? "-" : ""}${prefix}${num}${suffix}`;
  };
}

export type StepperFieldProps = {
  value: number;
  onChange: (value: number) => void;
  step: number;
  minValue?: number;
  maxValue?: number;
  "aria-label": string;
  label?: string;
  size?: "sm" | "md" | "lg";
  prefix?: string;
  suffix?: string;
  group?: boolean;
  decimalScale?: number;
  allowNegative?: boolean;
  className?: string;
  groupClassName?: string;
  valueClassName?: string;
};

export function StepperField({
  value,
  onChange,
  step,
  minValue,
  maxValue,
  "aria-label": ariaLabel,
  label,
  size,
  prefix = "",
  suffix = "",
  group = false,
  decimalScale,
  allowNegative = false,
  className,
  groupClassName,
  valueClassName,
}: StepperFieldProps) {
  const dialog = useOverlayState();
  const decimals = decimalScale ?? decimalsForStep(step);
  const [draft, setDraft] = useState<number | null>(null);

  const formatRaw = buildRawFormatter(prefix, suffix, group);
  const display = (v: number) =>
    `${prefix}${new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals, useGrouping: group }).format(v)}${suffix}`;

  const openDialog = () => {
    setDraft(null);
    dialog.open();
  };

  const confirm = () => {
    if (draft != null) onChange(roundToStep(draft, step, minValue, maxValue));
    dialog.close();
  };

  const hints: string[] = [];
  if (minValue != null) hints.push(`Min ${display(minValue)}`);
  if (maxValue != null) hints.push(`Max ${display(maxValue)}`);
  hints.push(`Step ${display(step)}`);

  return (
    <>
      <NumberStepper
        aria-label={ariaLabel}
        className={className}
        maxValue={maxValue}
        minValue={minValue}
        size={size}
        step={step}
        value={value}
        onChange={onChange}
      >
        <NumberStepper.Group className={groupClassName}>
          <NumberStepper.DecrementButton />
          <button
            aria-label={`Edit ${ariaLabel}`}
            className={`mx-2 cursor-pointer font-mono tabular-nums outline-none ${valueClassName ?? "text-sm"}`}
            type="button"
            onClick={openDialog}
          >
            {display(value)}
          </button>
          <NumberStepper.IncrementButton />
        </NumberStepper.Group>
      </NumberStepper>

      <Modal.Backdrop isOpen={dialog.isOpen} onOpenChange={dialog.setOpen}>
        <Modal.Container size="xs">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{label ?? ariaLabel}</Modal.Heading>
            </Modal.Header>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                confirm();
              }}
            >
              <Modal.Body className="flex flex-col items-start justify-center pt-4 gap-3">
                <NumberFlowInput
                  autoFocus
                  allowNegative={allowNegative}
                  className="text-foreground text-3xl font-bold tabular-nums outline-none"
                  decimalScale={decimals}
                  format={formatRaw}
                  isAllowed={(v) => allowNegative || v == null || v >= 0}
                  placeholder={display(value)}
                  value={draft ?? ""}
                  onChange={(v) => setDraft(v ?? null)}
                />
                <Description>{hints.join(" \u00b7 ")}</Description>
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
    </>
  );
}
