"use client";

import { EmptyState, Widget } from "@heroui-pro/react";
import { Button } from "@heroui/react";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.label}] widget crashed`, error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <Widget>
          <Widget.Header>
            <Widget.Title>{this.props.label}</Widget.Title>
          </Widget.Header>
          <Widget.Content>
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
          </Widget.Content>
        </Widget>
      );
    }
    return this.props.children;
  }
}
