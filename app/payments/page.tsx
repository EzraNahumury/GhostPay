"use client";

import { useState } from "react";
import LayoutShell from "@/components/LayoutShell";
import AgentGate from "@/components/AgentGate";
import { useAgent } from "@/hooks/useAgent";
import { usePayments } from "@/hooks/usePayments";
import { useBalances } from "@/hooks/useBalances";
import { PAY_TOKENS, PAY_TOKEN, type TokenInfo } from "@/lib/constants";
import { isAddress } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

function PaymentsInner() {
  const { agentId } = useAgent();
  const { payments, pay, refetch } = usePayments(agentId);
  const { bySymbol, celo, refetch: refetchBal } = useBalances();

  const [token, setToken] = useState<TokenInfo>(PAY_TOKEN);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  const bal = token.symbol === "CELO" ? celo.formatted : bySymbol(token.symbol)?.formatted ?? 0;

  const submit = async () => {
    if (!isAddress(recipient)) return toast.error("Invalid recipient address");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    if (amt > bal) return toast.error(`Insufficient ${token.symbol}`);
    setBusy(true);
    try {
      await pay({ token, recipient: recipient as `0x${string}`, amount: amt, memo });
      toast.success(`Sent ${amt} ${token.symbol}`);
      setRecipient("");
      setAmount("");
      setMemo("");
      await Promise.all([refetch(), refetchBal()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Send className="w-5 h-5 text-[#FBCB0A]" />
          <h1 className="font-heading font-semibold">Send a payment</h1>
        </div>

        <div className="flex gap-2">
          {PAY_TOKENS.map((t) => (
            <button
              key={t.symbol}
              onClick={() => setToken(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                token.symbol === t.symbol
                  ? "bg-[rgba(251,203,10,0.15)] text-[#FBCB0A]"
                  : "bg-[rgba(255,255,255,0.05)] text-[#A7B0C8]"
              }`}
            >
              {t.symbol}
            </button>
          ))}
          <span className="ml-auto text-xs text-[#A7B0C8] self-center">
            Balance: {bal.toFixed(2)} {token.symbol}
          </span>
        </div>

        <Input placeholder="Recipient address (0x…)" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        <Input placeholder={`Amount in ${token.symbol}`} value={amount} onChange={(e) => setAmount(e.target.value)} type="number" />
        <Input placeholder="Memo (optional)" value={memo} onChange={(e) => setMemo(e.target.value)} />

        <Button onClick={submit} disabled={busy} className="w-full bg-[#FBCB0A] text-[#0B0C10] font-semibold gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send {token.symbol}
        </Button>
      </div>

      <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] p-6">
        <h2 className="font-heading font-semibold mb-4">Recent payments</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-[#A7B0C8]">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-[rgba(255,255,255,0.02)]">
                <ArrowUpRight className="w-4 h-4 text-[#FBCB0A]" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {p.amount} {p.tokenSymbol}
                  </div>
                  <div className="text-xs text-[#A7B0C8] font-mono truncate">
                    to {p.recipient.slice(0, 8)}…{p.recipient.slice(-4)} {p.memo && `· ${p.memo}`}
                  </div>
                </div>
                <span className="text-[10px] text-[#35D07F]">{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <LayoutShell>
      <AgentGate>
        <PaymentsInner />
      </AgentGate>
    </LayoutShell>
  );
}
