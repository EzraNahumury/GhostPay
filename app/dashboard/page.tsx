"use client";

import Link from "next/link";
import LayoutShell from "@/components/LayoutShell";
import AgentGate from "@/components/AgentGate";
import AgentInsight from "@/components/AgentInsight";
import { useAgent } from "@/hooks/useAgent";
import { useBalances } from "@/hooks/useBalances";
import { useLlm } from "@/hooks/useLlm";
import { usePayments } from "@/hooks/usePayments";
import { PAY_TOKEN } from "@/lib/constants";
import { Ghost, Sparkles, Send, Database, Coins, Activity } from "lucide-react";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] p-5 ${className}`}>
      {children}
    </div>
  );
}

function DashInner() {
  const { agent, agentId } = useAgent();
  const { tokens, celo } = useBalances();
  const { calls } = useLlm(agentId);
  const { payments } = usePayments(agentId);

  const payBal = tokens.find((t) => t.symbol === PAY_TOKEN.symbol)?.formatted ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <Card className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[rgba(251,203,10,0.15)] flex items-center justify-center">
          <Ghost className="w-7 h-7 text-[#FBCB0A]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-heading font-semibold">{agent?.displayName || "My Agent"}</h1>
          <p className="text-xs text-[#A7B0C8] font-mono">
            Agent #{agentId?.toString()} · {agent?.active ? "Active" : "Inactive"}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-2 text-[#A7B0C8] text-xs mb-1">
            <Coins className="w-4 h-4" /> {PAY_TOKEN.symbol}
          </div>
          <div className="text-2xl font-semibold">{payBal.toFixed(2)}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-[#A7B0C8] text-xs mb-1">
            <Coins className="w-4 h-4" /> CELO
          </div>
          <div className="text-2xl font-semibold">{celo.formatted.toFixed(3)}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-[#A7B0C8] text-xs mb-1">
            <Sparkles className="w-4 h-4" /> AI calls
          </div>
          <div className="text-2xl font-semibold">{calls}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-[#A7B0C8] text-xs mb-1">
            <Activity className="w-4 h-4" /> Payments
          </div>
          <div className="text-2xl font-semibold">{payments.length}</div>
        </Card>
      </div>

      <AgentInsight />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/chat">
          <Card className="hover:border-[#FBCB0A]/40 transition cursor-pointer h-full">
            <Sparkles className="w-6 h-6 text-[#FBCB0A] mb-2" />
            <h3 className="font-semibold mb-1">Ask AI</h3>
            <p className="text-xs text-[#A7B0C8]">Pay per call in {PAY_TOKEN.symbol}. No subscription.</p>
          </Card>
        </Link>
        <Link href="/payments">
          <Card className="hover:border-[#FBCB0A]/40 transition cursor-pointer h-full">
            <Send className="w-6 h-6 text-[#FBCB0A] mb-2" />
            <h3 className="font-semibold mb-1">Send money</h3>
            <p className="text-xs text-[#A7B0C8]">Pay anyone in cUSD with an onchain receipt.</p>
          </Card>
        </Link>
        <Link href="/vault">
          <Card className="hover:border-[#FBCB0A]/40 transition cursor-pointer h-full">
            <Database className="w-6 h-6 text-[#FBCB0A] mb-2" />
            <h3 className="font-semibold mb-1">Vault</h3>
            <p className="text-xs text-[#A7B0C8]">Store documents on IPFS, anchored onchain.</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <LayoutShell>
      <AgentGate>
        <DashInner />
      </AgentGate>
    </LayoutShell>
  );
}
