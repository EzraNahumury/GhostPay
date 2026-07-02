/**
 * demoProof — Hardening utilities to make the GhostPay demo impossible to break.
 *
 * Provides:
 *   - ErrorBoundary (React error boundary with fallback + retry)
 *   - withTimeout (wraps a promise with a configurable timeout)
 *   - withRetry (retries a promise with exponential backoff)
 *   - useNetworkStatus (online/offline detection hook)
 *   - safePromise (prevents unhandled rejections + optional toast)
 *   - useLoadingDeadlock (cuts off spinners after a timeout)
 *   - createSafeHandler (wraps event handlers to catch + toast errors)
 *   - createEscapeHandler (Escape key handler for modals)
 */

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw } from "lucide-react";

// ══════════════════════════════════════════════════════════════════════════
//  Error Boundary
// ══════════════════════════════════════════════════════════════════════════

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that catches render errors and shows a fallback UI
 * with a "Try Again" button. Prevents the entire app from crashing when
 * a single component throws during render.
 */
export class DemoErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, _errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 gap-4 rounded-xl bg-destructive/5 border border-destructive/20">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <div className="text-center max-w-md">
            <h3 className="text-sm font-semibold text-destructive mb-1">
              Something went wrong
            </h3>
            <p className="text-xs text-destructive/60 mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  Promise Timeout
// ══════════════════════════════════════════════════════════════════════════

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * the given time, it rejects with a TimeoutError.
 */
export class TimeoutError extends Error {
  constructor(ms: number, label?: string) {
    super(label ? `Operation timed out after ${ms}ms: ${label}` : `Operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(ms, label));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  Retry with Exponential Backoff
// ══════════════════════════════════════════════════════════════════════════

/**
 * Retries a promise-returning function with exponential backoff.
 * Does NOT retry TimeoutErrors — those are surfaced immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    label?: string;
  } = {},
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 1000, maxDelayMs = 8000, label } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (err instanceof TimeoutError) {
        throw err;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ══════════════════════════════════════════════════════════════════════════
//  Safe Promise (prevents unhandled rejections)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Wraps a promise to prevent unhandled rejections.
 * Optionally shows a toast on error.
 */
export function safePromise<T>(
  promise: Promise<T>,
  options?: {
    toastOnError?: string;
    silenceErrors?: boolean;
  },
): Promise<T | undefined> {
  return promise.catch((err) => {
    if (options?.toastOnError) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${options.toastOnError}: ${msg}`);
    }
    return undefined;
  });
}

// ══════════════════════════════════════════════════════════════════════════
//  Network Status Hook
// ══════════════════════════════════════════════════════════════════════════

/**
 * Hook that tracks online/offline status.
 */
export function useNetworkStatus(): { online: boolean; since: number } {
  const [online, setOnline] = useState(true);
  const [since, setSince] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    setSince(Date.now());
  }, []);

  const goOnline = useCallback(() => {
    setOnline(true);
    setSince(Date.now());
  }, []);

  const goOffline = useCallback(() => {
    setOnline(false);
    setSince(Date.now());
  }, []);

  useEffect(() => {
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [goOnline, goOffline]);

  return { online, since };
}

// ══════════════════════════════════════════════════════════════════════════
//  Loading Deadlock Protection
// ══════════════════════════════════════════════════════════════════════════

/**
 * Hook that prevents infinite spinners by cutting off loading state
 * after a timeout. Returns `timedOut` boolean — when true, the
 * loading state has been active for longer than the timeout.
 */
export function useLoadingDeadlock(
  isLoading: boolean,
  timeoutMs: number = 30_000,
): { timedOut: boolean; reset: () => void } {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setTimedOut(true);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [isLoading, timeoutMs]);

  const reset = useCallback(() => setTimedOut(false), []);

  return { timedOut, reset };
}

// ══════════════════════════════════════════════════════════════════════════
//  Safe Event Handler Creator
// ══════════════════════════════════════════════════════════════════════════

/**
 * Wraps an event handler to catch errors and show a toast,
 * preventing unhandled rejections from async handlers.
 */
export function createSafeHandler<T extends (...args: any[]) => any>(
  handler: T,
  errorMessage?: string,
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    try {
      return await handler(...args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(errorMessage ? `${errorMessage}: ${msg}` : msg);
      return undefined;
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  Keyboard Handler Helper
// ══════════════════════════════════════════════════════════════════════════

/**
 * Creates an onKeyDown handler for modals that closes on Escape.
 */
export function createEscapeHandler(
  onClose: () => void,
): (e: React.KeyboardEvent) => void {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };
}
