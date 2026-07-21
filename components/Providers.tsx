"use client";

import { ConfirmProvider } from "@/components/ConfirmDialog";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <ConfirmProvider>{children}</ConfirmProvider>;
}
