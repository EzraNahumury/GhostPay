"use client";

import { useCallback, useState } from "react";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { memoryVault } from "@/lib/contracts";
import { uploadToIpfs, getIpfsUrl } from "@/lib/IpfsService";
import { saveLocalMemory } from "@/lib/localMemoryStore";
import { useCustomWallet } from "@/contexts/CustomWallet";

const VIS = ["private", "shared", "shared_with_auditor"] as const;

export interface MemoryView {
  seq: number;
  cid: string;
  url: string;
  dataType: string;
  ts: number;
  visibility: string;
  size: number;
  label: string;
}

export type UploadStep = "idle" | "uploading" | "storing" | "done" | "error";

export function useMemories(agentId: bigint | undefined) {
  const { sendTransaction } = useCustomWallet();
  const [step, setStep] = useState<UploadStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const { data: raw, refetch, isPending } = useReadContract({
    ...memoryVault,
    functionName: "all",
    args: agentId ? [agentId] : undefined,
    query: { enabled: Boolean(agentId) },
  });

  const memories: MemoryView[] = ((raw as unknown[]) ?? []).map((r, i) => {
    const rec = r as {
      cid: string; dataType: string; ts: bigint;
      visibility: number; size: bigint; label: string;
    };
    return {
      seq: i,
      cid: rec.cid,
      url: getIpfsUrl(rec.cid),
      dataType: rec.dataType,
      ts: Number(rec.ts) * 1000,
      visibility: VIS[rec.visibility] ?? "private",
      size: Number(rec.size),
      label: rec.label,
    };
  });

  /**
   * Upload a file to IPFS and record the pointer on-chain.
   * (Client-side encryption via Lit can be layered before upload later.)
   */
  const upload = useCallback(
    async (params: {
      data: Uint8Array;
      dataType: string;
      label: string;
      isPrivate: boolean;
      filename?: string;
    }) => {
      if (!agentId) throw new Error("Create an agent first");
      setError(null);
      try {
        setStep("uploading");
        const { cid, size } = await uploadToIpfs(params.data, params.filename);

        // local index (visible immediately even if the chain write lags)
        saveLocalMemory({
          id: `local-${Date.now()}`,
          blobId: cid,
          dataType: params.dataType,
          label: params.label,
          visibility: params.isPrivate ? "private" : "public",
          dataSize: size,
          timestamp: Date.now(),
        });

        setStep("storing");
        await sendTransaction({
          address: memoryVault.address,
          abi: memoryVault.abi as unknown as never,
          functionName: "store",
          args: [
            agentId,
            cid,
            params.dataType,
            params.isPrivate ? 0 : 1, // Visibility enum
            BigInt(size),
            params.label,
          ],
        });
        setStep("done");
        await refetch();
        return cid;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
        setStep("error");
        throw e;
      }
    },
    [agentId, sendTransaction, refetch],
  );

  const totalSizeMB =
    memories.reduce((s, m) => s + m.size, 0) / (1024 * 1024);

  return { memories, isPending, upload, step, error, refetch, totalSizeMB, formatUnits };
}
