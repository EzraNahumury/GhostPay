"use client";

import { useState } from "react";
import LayoutShell from "@/components/LayoutShell";
import AgentGate from "@/components/AgentGate";
import { useAgent } from "@/hooks/useAgent";
import { useCompliance } from "@/hooks/useCompliance";
import { isAddress } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

function ComplianceInner() {
  const { agentId } = useAgent();
  const { latest, count, createViewKey, revokeViewKey } = useCompliance(agentId);
  const [viewer, setViewer] = useState("");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isAddress(viewer)) return toast.error("Invalid viewer address");
    const d = parseFloat(days);
    if (!d || d <= 0) return toast.error("Enter a duration");
    setBusy(true);
    try {
      await createViewKey(viewer as `0x${string}`, label || "Audit access", d);
      toast.success("View-key granted");
      setViewer("");
      setLabel("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#FBCB0A]" />
          <h1 className="font-heading font-semibold">Selective disclosure</h1>
        </div>
        <p className="text-sm text-[#A7B0C8]">
          Grant an auditor a time-boxed view-key. Access is enforced onchain and read by the
          decryption layer (Lit) before releasing keys.
        </p>

        <Input placeholder="Viewer address (0x…)" value={viewer} onChange={(e) => setViewer(e.target.value)} />
        <Input placeholder="Label (e.g. Annual Audit 2026)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input placeholder="Duration (days)" type="number" value={days} onChange={(e) => setDays(e.target.value)} />

        <Button onClick={submit} disabled={busy} className="w-full bg-[#FBCB0A] text-[#0B0C10] font-semibold gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          Grant view-key
        </Button>
      </div>

      <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] p-6">
        <h2 className="font-heading font-semibold mb-4">View-keys ({count})</h2>
        {!latest ? (
          <p className="text-sm text-[#A7B0C8]">No view-keys yet.</p>
        ) : (
          <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-[rgba(255,255,255,0.02)]">
            <KeyRound className="w-4 h-4 text-[#FBCB0A]" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{latest.label}</div>
              <div className="text-xs text-[#A7B0C8] font-mono truncate">
                {latest.viewer.slice(0, 10)}… · expires {new Date(latest.expiresAt).toLocaleDateString()}
              </div>
            </div>
            {latest.active ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => revokeViewKey(latest.idx).then(() => toast.success("Revoked")).catch(() => toast.error("Failed"))}
              >
                Revoke
              </Button>
            ) : (
              <span className="text-[10px] text-[#A7B0C8]">Revoked</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompliancePage() {
  return (
    <LayoutShell>
      <AgentGate>
        <ComplianceInner />
      </AgentGate>
    </LayoutShell>
  );
}
