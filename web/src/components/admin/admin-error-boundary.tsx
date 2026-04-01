"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface AdminErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  description?: string;
  onReset?: () => void;
}

interface AdminErrorBoundaryState {
  hasError: boolean;
}

export class AdminErrorBoundary extends Component<
  AdminErrorBoundaryProps,
  AdminErrorBoundaryState
> {
  state: AdminErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AdminErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[AdminErrorBoundary]", error);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 64,
            borderRadius: 12,
            background: "var(--cv4-surface-primary)",
            border: "1px solid var(--cv4-border-subtle)",
            textAlign: "center",
          }}
        >
          <AlertTriangle
            size={48}
            style={{
              color: "var(--cv4-text-muted)",
              opacity: 0.5,
              marginBottom: 16,
            }}
          />
          <div
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
            }}
          >
            {this.props.title ?? "Something went wrong"}
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-muted)",
              marginTop: 8,
            }}
          >
            {this.props.description ??
              "An unexpected error occurred. Try refreshing the page."}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              marginTop: 16,
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--cv4-btn-primary)",
              color: "var(--cv4-btn-primary-text)",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
