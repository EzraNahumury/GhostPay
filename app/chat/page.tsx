"use client";

import { useRef, useState } from "react";
import LayoutShell from "@/components/LayoutShell";
import AgentGate from "@/components/AgentGate";
import { useAgent } from "@/hooks/useAgent";
import { useBalances } from "@/hooks/useBalances";
import { useLlm, LLM_MODELS, type ChatMessage, type LlmModel } from "@/hooks/useLlm";
import { PAY_TOKENS, explorerTxUrl, type TokenInfo } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Loader2, ExternalLink, Activity } from "lucide-react";
import { toast } from "sonner";

function ChatInner() {
  const { agentId } = useAgent();
  const { ask, step, calls, lastTxHash, refundable, selfRefund } = useLlm(agentId);
  const { bySymbol, celo } = useBalances();
  const [model, setModel] = useState<LlmModel>(LLM_MODELS[0]);
  const [token, setToken] = useState<TokenInfo>(PAY_TOKENS[0]);
  const tokenBal = token.symbol === "CELO" ? celo.formatted : bySymbol(token.symbol)?.formatted ?? 0;
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const busy = step === "paying" || step === "generating";
  const endRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (tokenBal < model.price) {
      toast.error(`Not enough ${token.symbol} — need ${model.price}, have ${tokenBal.toFixed(3)}`);
      return;
    }
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    try {
      const reply = await ask(model, token, next);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#FBCB0A]" />
          <h1 className="text-lg font-heading font-semibold">Pay-as-you-go AI</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#A7B0C8]">
          <Activity className="w-4 h-4 text-[#35D07F]" />
          {calls} paid calls
        </div>
      </div>

      {/* Model selector */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {LLM_MODELS.map((m) => (
          <button
            key={m.id}
            onClick={() => setModel(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              model.id === m.id
                ? "bg-[rgba(251,203,10,0.15)] text-[#FBCB0A]"
                : "bg-[rgba(255,255,255,0.05)] text-[#A7B0C8] hover:text-[#F4F6FF]"
            }`}
          >
            {m.label} · {m.price} {token.symbol}
          </button>
        ))}
      </div>

      {/* Pay-token selector */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-[11px] text-[#A7B0C8]">Pay with:</span>
        {PAY_TOKENS.map((t) => (
          <button
            key={t.symbol}
            onClick={() => setToken(t)}
            title={t.name}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              token.symbol === t.symbol
                ? "bg-[rgba(53,208,127,0.15)] text-[#35D07F]"
                : "bg-[rgba(255,255,255,0.05)] text-[#A7B0C8] hover:text-[#F4F6FF]"
            }`}
          >
            {t.symbol}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-[#A7B0C8]">
          Balance: {tokenBal.toFixed(2)} {token.symbol}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 rounded-xl bg-[rgba(255,255,255,0.02)] p-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#A7B0C8] gap-2">
            <Sparkles className="w-8 h-8 text-[#FBCB0A]" />
            <p className="text-sm">Ask anything. Each message is paid onchain in {token.symbol} — no subscription.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-[#FBCB0A] text-[#0B0C10]"
                  : "bg-[rgba(255,255,255,0.06)] text-[#F4F6FF]"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-[#A7B0C8]">
            <Loader2 className="w-4 h-4 animate-spin" />
            {step === "paying" ? `Paying ${model.price} ${token.symbol} onchain…` : "Generating…"}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {refundable && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#FBCB0A]/30 bg-[rgba(251,203,10,0.08)] px-4 py-3">
          <span className="text-xs text-[#F4F6FF]">
            Call failed — your {model.price} {token.symbol} is held in escrow, not spent.
            The backend refunds automatically; if not, reclaim it here (available after ~15 min).
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-[#FBCB0A] shrink-0"
            onClick={() =>
              selfRefund()
                .then(() => toast.success("Refunded"))
                .catch((e) =>
                  toast.error(e instanceof Error ? e.message : "Refund not available yet"),
                )
            }
          >
            Refund
          </Button>
        </div>
      )}

      {lastTxHash && (
        <a
          href={explorerTxUrl(lastTxHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#A7B0C8] hover:text-[#FBCB0A]"
        >
          Last payment onchain <ExternalLink className="w-3 h-3" />
        </a>
      )}

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={`Message (${model.price} ${token.symbol})`}
          className="flex-1 resize-none rounded-xl bg-[rgba(255,255,255,0.05)] px-4 py-3 text-sm text-[#F4F6FF] placeholder:text-[#A7B0C8] focus:outline-none"
        />
        <Button
          onClick={send}
          disabled={busy || !input.trim()}
          className="bg-[#FBCB0A] text-[#0B0C10] font-semibold self-end h-[46px] px-4"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <LayoutShell>
      <AgentGate>
        <ChatInner />
      </AgentGate>
    </LayoutShell>
  );
}
