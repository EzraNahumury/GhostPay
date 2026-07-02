"use client";

import { DemoErrorBoundary } from "@/lib/demoProof";

/**
 * Wraps children in a DemoErrorBoundary.
 * Import this in every page to prevent crashes from taking down the app.
 */
export default function PageErrorBoundary({
  children,
  pageName,
}: {
  children: React.ReactNode;
  pageName?: string;
}) {
  return (
    <DemoErrorBoundary
      onError={(error) => {
        console.warn(`[${pageName || "Page"}] Error boundary caught:`, error.message);
      }}
    >
      {children}
    </DemoErrorBoundary>
  );
}
