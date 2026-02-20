"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Global client-side ErrorBoundary.
 *
 * Catches React rendering errors so the whole page doesn't crash.
 * Optionally reports to /client-errors (no sensitive data).
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Report to API without sensitive data
    try {
      const payload = {
        message: error?.message || "Unknown error",
        stack: (error?.stack || "").slice(0, 2000),
        componentStack: (info?.componentStack || "").slice(0, 2000),
        url: typeof window !== "undefined" ? window.location.pathname : "",
        timestamp: new Date().toISOString(),
      };

      fetch("/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Silently ignore reporting failures
      });
    } catch {
      // Never let reporting crash the boundary itself
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <h2 className="text-lg font-semibold text-white">
              Algo salió mal
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Ocurrió un error inesperado. Intenta recargar la página.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="mt-6 rounded-xl bg-fuchsia-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-fuchsia-500"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
