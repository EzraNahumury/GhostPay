"use client";

import { useCallback } from "react";
import { useReadContract } from "wagmi";
import { compliance } from "@/lib/contracts";
import { useCustomWallet } from "@/contexts/CustomWallet";

export interface ViewKeyView {
  idx: number;
  viewer: `0x${string}`;
  label: string;
  createdAt: number;
  expiresAt: number;
  active: boolean;
}

export function useCompliance(agentId: bigint | undefined) {
  const { sendTransaction } = useCustomWallet();

  const { data: count, refetch: refetchCount } = useReadContract({
    ...compliance,
    functionName: "count",
    args: agentId ? [agentId] : undefined,
    query: { enabled: Boolean(agentId) },
  });

  const n = Number((count as bigint | undefined) ?? 0n);

  const { data: raw, refetch: refetchKeys, isPending } = useReadContract({
    ...compliance,
    functionName: "viewKeyAt",
    // read only the latest for a light default; full list can page via idx
    args: agentId && n > 0 ? [agentId, BigInt(n - 1)] : undefined,
    query: { enabled: Boolean(agentId && n > 0) },
  });

  const latest: ViewKeyView | null = raw
    ? (() => {
        const k = raw as {
          viewer: `0x${string}`; label: string;
          createdAt: bigint; expiresAt: bigint; active: boolean;
        };
        return {
          idx: n - 1,
          viewer: k.viewer,
          label: k.label,
          createdAt: Number(k.createdAt) * 1000,
          expiresAt: Number(k.expiresAt) * 1000,
          active: k.active,
        };
      })()
    : null;

  const createViewKey = useCallback(
    async (viewer: `0x${string}`, label: string, durationDays: number) => {
      if (!agentId) throw new Error("Create an agent first");
      const durationMs = BigInt(Math.floor(durationDays * 24 * 60 * 60 * 1000));
      await sendTransaction({
        address: compliance.address,
        abi: compliance.abi as unknown as never,
        functionName: "createViewKey",
        args: [agentId, viewer, label, durationMs],
      });
      await Promise.all([refetchCount(), refetchKeys()]);
    },
    [agentId, sendTransaction, refetchCount, refetchKeys],
  );

  const revokeViewKey = useCallback(
    async (idx: number) => {
      if (!agentId) throw new Error("Create an agent first");
      await sendTransaction({
        address: compliance.address,
        abi: compliance.abi as unknown as never,
        functionName: "revokeViewKey",
        args: [agentId, BigInt(idx)],
      });
      await refetchKeys();
    },
    [agentId, sendTransaction, refetchKeys],
  );

  return { count: n, latest, isPending, createViewKey, revokeViewKey };
}
