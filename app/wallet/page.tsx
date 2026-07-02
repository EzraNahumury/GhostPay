"use client";

import { useState } from "react";
import LayoutShell from "@/components/LayoutShell";
import AgentGate from "@/components/AgentGate";
import { useAccount } from "wagmi";
import { useBalances } from "@/hooks/useBalances";
import { explorerAddrUrl } from "@/lib/constants";
import { Copy, ExternalLink, Wallet as WalletIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function WalletInner() {
  const { address } = useAccount();
  const { tokens, celo, refetch, isPending } = useBalances();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] p-6">
        <div className="flex items-center gap-2 text-[#A7B0C8] text-sm mb-3">
          <WalletIcon className="w-4 h-4" /> Your Celo address
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm font-mono break-all text-[#F4F6FF]">{address}</code>
          <Button variant="ghost" size="icon" onClick={copy}>
            <Copy className={`w-4 h-4 ${copied ? "text-[#35D07F]" : ""}`} />
          </Button>
          <a href={address ? explorerAddrUrl(address) : "#"} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="icon">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </div>

      <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold">Balances</h2>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="space-y-2">
          <Row symbol="CELO" amount={celo.formatted} />
          {tokens.map((t) => (
            <Row key={t.symbol} symbol={t.symbol} amount={t.formatted} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ symbol, amount }: { symbol: string; amount: number }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-[rgba(255,255,255,0.02)]">
      <span className="text-sm font-medium">{symbol}</span>
      <span className="text-sm font-mono">{amount.toFixed(4)}</span>
    </div>
  );
}

export default function WalletPage() {
  return (
    <LayoutShell>
      <AgentGate>
        <WalletInner />
      </AgentGate>
    </LayoutShell>
  );
}
