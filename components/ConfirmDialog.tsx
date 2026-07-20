"use client";

import { PressableFeedback } from "@heroui-pro/react";
import type { ButtonProps } from "@heroui/react";
import { Button, Modal, useOverlayState } from "@heroui/react";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

const HOLD_MS = 1000;

const SUCCESS_BUTTON_STYLE = {
  "--button-bg": "var(--success)",
  "--button-bg-hover": "var(--success-hover)",
  "--button-bg-pressed": "var(--success-hover)",
  "--button-fg": "var(--success-foreground)",
  borderColor: "var(--success)",
} as CSSProperties;

type ConfirmVariant = ButtonProps["variant"] | "success";

type ConfirmOptions = {
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmVariant;
};

export function useConfirm() {
  const state = useOverlayState();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const actionRef = useRef<() => void>(() => { });

  const confirm = useCallback(
    (action: () => void, opts: ConfirmOptions) => {
      actionRef.current = action;
      setOptions(opts);
      state.open();
    },
    [state]
  );

  const handleConfirm = useCallback(() => {
    state.close();
    actionRef.current();
  }, [state]);

  const isSuccess = options?.confirmVariant === "success";
  const confirmVariant: ButtonProps["variant"] =
    options?.confirmVariant == null || options.confirmVariant === "success" ? "primary" : options.confirmVariant;
  const isDanger = confirmVariant === "danger" || confirmVariant === "danger-soft";
  const holdClassName = isSuccess
    ? "bg-success text-success-foreground"
    : isDanger
      ? "bg-danger text-danger-foreground"
      : "bg-accent text-accent-foreground";
  const confirmLabel = options?.confirmLabel ?? "Confirm";

  const dialog = (
    <Modal.Backdrop isOpen={state.isOpen} onOpenChange={state.setOpen}>
      <Modal.Container placement="center">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{options?.title}</Modal.Heading>
          </Modal.Header>
          {options?.body != null && <Modal.Body className="pt-1 text-md">{options.body}</Modal.Body>}
          <Modal.Footer>
            <Button fullWidth style={isSuccess ? SUCCESS_BUTTON_STYLE : undefined} variant={confirmVariant}>
              <PressableFeedback.HoldConfirm className={holdClassName} duration={HOLD_MS} onComplete={handleConfirm}>
                Hold to {confirmLabel}
              </PressableFeedback.HoldConfirm>
              Hold to {confirmLabel}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );

  return { confirm, dialog };
}
