"use client";

import { EmptyState } from "@heroui-pro/react";
import { Button } from "@heroui/react";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  label?: string;
  children: ReactNode;
};

type State = {
  error: Error | null;
  resetKey: number;
};

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const label = this.props.label ?? "widget";
    console.error(`[${label}] widget crashed`, error, info.componentStack);
  }

  componentDidMount(): void {
    document.addEventListener("visibilitychange", this.handleResume);
    window.addEventListener("pageshow", this.handleResume);
  }

  componentWillUnmount(): void {
    document.removeEventListener("visibilitychange", this.handleResume);
    window.removeEventListener("pageshow", this.handleResume);
  }

  handleResume = (): void => {
    if (document.visibilityState !== "visible") return;
    if (this.state.error == null) return;
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  handleRetry = (): void => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <EmptyState size="sm">
          <EmptyState.Header>
            <EmptyState.Title>Something went wrong</EmptyState.Title>
            <EmptyState.Description>{this.state.error.message}</EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>
            <Button size="sm" variant="secondary" onPress={this.handleRetry}>
              Retry
            </Button>
          </EmptyState.Content>
        </EmptyState>
      );
    }
    return <div key={this.state.resetKey}>{this.props.children}</div>;
  }
}
