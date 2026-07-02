"use client";

import { useRef, useState } from "react";
import LayoutShell from "@/components/LayoutShell";
import AgentGate from "@/components/AgentGate";
import { useAgent } from "@/hooks/useAgent";
import { useMemories } from "@/hooks/useMemories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database, Upload, Lock, Globe, FileText, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DATA_TYPES = ["payslip", "kyc", "receipt", "report", "proof", "image", "other"];

function VaultInner() {
  const { agentId } = useAgent();
  const { memories, upload, openMemory, step, totalSizeMB } = useMemories(agentId);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [dataType, setDataType] = useState("receipt");
  const [isPrivate, setIsPrivate] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = step === "encrypting" || step === "uploading" || step === "storing";

  const submit = async () => {
    if (!file) return toast.error("Choose a file");
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      await upload({
        data: buf,
        dataType,
        label: label || file.name,
        isPrivate,
        filename: file.name,
      });
      toast.success("Stored on IPFS + onchain");
      setFile(null);
      setLabel("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-[#FBCB0A]" />
          <h1 className="font-heading font-semibold">Memory Vault</h1>
          <span className="ml-auto text-xs text-[#A7B0C8]">{totalSizeMB.toFixed(2)} MB stored</span>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-[rgba(255,255,255,0.15)] rounded-xl p-6 text-center cursor-pointer hover:border-[#FBCB0A]/40"
        >
          <Upload className="w-6 h-6 text-[#A7B0C8] mx-auto mb-2" />
          <p className="text-sm text-[#A7B0C8]">{file ? file.name : "Click to choose a file (max 50MB)"}</p>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />

        <div className="flex gap-2 flex-wrap">
          {DATA_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setDataType(t)}
              className={`px-2.5 py-1 rounded-lg text-xs transition ${
                dataType === t ? "bg-[rgba(251,203,10,0.15)] text-[#FBCB0A]" : "bg-[rgba(255,255,255,0.05)] text-[#A7B0C8]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsPrivate(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm ${
              isPrivate ? "bg-[rgba(251,203,10,0.15)] text-[#FBCB0A]" : "bg-[rgba(255,255,255,0.05)] text-[#A7B0C8]"
            }`}
          >
            <Lock className="w-4 h-4" /> Private
          </button>
          <button
            onClick={() => setIsPrivate(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm ${
              !isPrivate ? "bg-[rgba(251,203,10,0.15)] text-[#FBCB0A]" : "bg-[rgba(255,255,255,0.05)] text-[#A7B0C8]"
            }`}
          >
            <Globe className="w-4 h-4" /> Public
          </button>
        </div>

        <Button onClick={submit} disabled={busy || !file} className="w-full bg-[#FBCB0A] text-[#0B0C10] font-semibold gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {step === "encrypting"
            ? "Encrypting…"
            : step === "uploading"
              ? "Uploading to IPFS…"
              : step === "storing"
                ? "Storing onchain…"
                : "Upload"}
        </Button>
      </div>

      <div className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] p-6">
        <h2 className="font-heading font-semibold mb-4">Stored records</h2>
        {memories.length === 0 ? (
          <p className="text-sm text-[#A7B0C8]">Nothing stored yet.</p>
        ) : (
          <div className="space-y-2">
            {memories.map((m) => (
              <div key={m.seq} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-[rgba(255,255,255,0.02)]">
                <FileText className="w-4 h-4 text-[#FBCB0A]" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    {m.visibility === "private" && <Lock className="w-3 h-3 text-[#FBCB0A]" />}
                    {m.label}
                  </div>
                  <div className="text-xs text-[#A7B0C8]">
                    {m.dataType} · {(m.size / 1024).toFixed(1)} KB · {m.visibility}
                  </div>
                </div>
                <button
                  title={m.visibility === "private" ? "Decrypt & open" : "Open"}
                  onClick={() =>
                    openMemory(m).catch((e) =>
                      toast.error(e instanceof Error ? e.message : "Could not open"),
                    )
                  }
                >
                  <ExternalLink className="w-4 h-4 text-[#A7B0C8] hover:text-[#FBCB0A]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VaultPage() {
  return (
    <LayoutShell>
      <AgentGate>
        <VaultInner />
      </AgentGate>
    </LayoutShell>
  );
}
