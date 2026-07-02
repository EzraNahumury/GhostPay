"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Legacy /auth route. Wallet-based auth needs no OAuth callback, so this just
 * forwards to the dashboard (connect/create happens in-app via AgentGate).
 */
export default function AuthPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0B0C10] text-[#F4F6FF] gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-[#FBCB0A]" />
      <p className="text-sm text-[#A7B0C8]">Redirecting…</p>
    </div>
  );
}
