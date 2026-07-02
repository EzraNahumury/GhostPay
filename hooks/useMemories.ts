"use client";

import { useCallback, useState } from "react";
import { useAccount, useReadContract, useSignMessage } from "wagmi";
import { memoryVault } from "@/lib/contracts";
import { uploadToIpfs, downloadFromIpfs, getIpfsUrl } from "@/lib/IpfsService";
import { saveLocalMemory } from "@/lib/localMemoryStore";
import {
  VAULT_SIGN_MESSAGE,
  deriveAesKey,
  encryptBytes,
  decryptBytes,
  isEncrypted,
} from "@/lib/cryptoVault";
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

export type UploadStep = "idle" | "encrypting" | "uploading" | "storing" | "done" | "error";

// In-memory derived-key cache (per wallet) so we sign at most once per session.
let cachedKey: { addr: string; key: CryptoKey } | null = null;

export function useMemories(agentId: bigint | undefined) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { sendTransaction } = useCustomWallet();
  const [step, setStep] = useState<UploadStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const getKey = useCallback(async (): Promise<CryptoKey> => {
    if (cachedKey && cachedKey.addr === address) return cachedKey.key;
    const sig = await signMessageAsync({ message: VAULT_SIGN_MESSAGE });
    const key = await deriveAesKey(sig);
    cachedKey = { addr: address ?? "", key };
    return key;
  }, [address, signMessageAsync]);

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
   * Encrypt (if private) → upload to IPFS → record the pointer on-chain.
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
        let payload = params.data;
        if (params.isPrivate) {
          setStep("encrypting");
          const key = await getKey();
          payload = await encryptBytes(key, params.data);
        }

        setStep("uploading");
        const { cid } = await uploadToIpfs(payload, params.filename);

        saveLocalMemory({
          id: `local-${Date.now()}`,
          blobId: cid,
          dataType: params.dataType,
          label: params.label,
          visibility: params.isPrivate ? "private" : "public",
          dataSize: params.data.length,
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
            params.isPrivate ? 0 : 1,
            BigInt(params.data.length),
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
    [agentId, getKey, sendTransaction, refetch],
  );

  /**
   * Fetch a memory blob, decrypt if it's an encrypted (private) file, and open it.
   */
  const openMemory = useCallback(
    async (m: MemoryView) => {
      const { data } = await downloadFromIpfs(m.cid);
      let bytes = data;
      if (isEncrypted(bytes)) {
        const key = await getKey();
        bytes = await decryptBytes(key, bytes);
      }
      const blob = new Blob([bytes as BlobPart]);
      const objUrl = URL.createObjectURL(blob);
      window.open(objUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
    },
    [getKey],
  );

  const totalSizeMB = memories.reduce((s, m) => s + m.size, 0) / (1024 * 1024);

  return { memories, isPending, upload, openMemory, step, error, refetch, totalSizeMB };
}
