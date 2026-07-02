"use client";

import { useMemo } from "react";
import { Brain } from "lucide-react";
import { useAgent } from "@/hooks/useAgent";
import { useBalances } from "@/hooks/useBalances";
import { usePayments } from "@/hooks/usePayments";
import { useMemories } from "@/hooks/useMemories";
import { buildAgentContext, analyzeContext } from "@/lib/agentEngine";
import { PAY_TOKEN } from "@/lib/constants";

/**
 * Read-only view of the deterministic agent rule engine: shows what the agent
 * observes about the wallet and its current suggestion. No transactions.
 */
export default function AgentInsight() {
  const { agentId } = useAgent();
  const { celo, bySymbol } = useBalances();
  const { payments } = usePayments(agentId);
  const { memories } = useMemories(agentId);

  const reasoning = useMemo(() => {
    const ctx = buildAgentContext({
      agentId: agentId?.toString(),
      sui: celo.formatted,
      usdc: bySymbol(PAY_TOKEN.symbol)?.formatted ?? 0,
      deep: 0,
      payments: payments.map((p, i) => ({
        id: String(i),
        seq: p.seq,
        amount: p.amount,
        currency: p.tokenSymbol,
        recipient: p.recipient,
        memo: p.memo,
        status: p.status.toLowerCase(),
        timestamp: p.ts,
      })),
      memories: memories.map((m) => ({
        id: String(m.seq),
        seq: m.seq,
        blobId: m.cid,
        dataType: m.dataType,
        visibility: m.visibility,
        label: m.label,
        timestamp: m.ts,
      })),
      runCount: payments.length + memories.length,
    });
    return analyzeContext(ctx);
  }, [agentId, celo.formatted, bySymbol, payments, memories]);

  const conf = reasoning.confidence;
  const confColor =
    conf === "high" ? "text-[#35D07F]" : conf === "medium" ? "text-[#FBCB0A]" : "text-[#A7B0C8]";

  return (
    <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-5 h-5 text-[#FBCB0A]" />
        <h3 className="font-heading font-semibold">Agent insight</h3>
        <span className={`ml-auto text-xs ${confColor}`}>confidence: {conf}</span>
      </div>
      <ul className="space-y-1.5 mb-3">
        {reasoning.observations.slice(0, 5).map((o, i) => (
          <li key={i} className="text-xs text-[#A7B0C8] flex gap-2">
            <span className="text-[#FBCB0A]">•</span>
            <span>{o}</span>
          </li>
        ))}
      </ul>
      <div className="text-sm text-[#F4F6FF] bg-[rgba(251,203,10,0.06)] rounded-lg px-3 py-2">
        <span className="text-[#FBCB0A] font-medium">Suggestion: </span>
        {reasoning.justification}
      </div>
    </div>
  );
}
