"use client";

import { useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { keccak256, toHex, decodeEventLog } from "viem";
import { agentRegistry } from "@/lib/contracts";
import { CONTRACTS_DEPLOYED } from "@/lib/constants";
import { useCustomWallet } from "@/contexts/CustomWallet";

export interface AgentInfo {
  agentId: bigint;
  displayName: string;
  emailHash: `0x${string}`;
  createdAt: bigint;
  active: boolean;
}

/**
 * Reads the connected wallet's primary agent and exposes createAgent.
 */
export function useAgent() {
  const { address } = useAccount();
  const { sendTransaction } = useCustomWallet();

  const { data: primaryId, refetch: refetchId, isPending: idPending } = useReadContract({
    ...agentRegistry,
    functionName: "primaryAgentOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && CONTRACTS_DEPLOYED) },
  });

  const agentId = (primaryId as bigint | undefined) ?? 0n;
  const hasAgent = agentId > 0n;

  const { data: agentTuple, refetch: refetchAgent, isPending: agentPending } = useReadContract({
    ...agentRegistry,
    functionName: "agents",
    args: hasAgent ? [agentId] : undefined,
    query: { enabled: hasAgent },
  });

  let agent: AgentInfo | null = null;
  if (hasAgent && agentTuple) {
    const t = agentTuple as unknown as [string, `0x${string}`, bigint, boolean];
    agent = {
      agentId,
      displayName: t[0],
      emailHash: t[1],
      createdAt: t[2],
      active: t[3],
    };
  }

  const createAgent = useCallback(
    async (displayName: string, email: string): Promise<bigint> => {
      const emailHash = email ? keccak256(toHex(email)) : ("0x" + "0".repeat(64)) as `0x${string}`;
      const receipt = await sendTransaction({
        address: agentRegistry.address,
        abi: agentRegistry.abi as unknown as never,
        functionName: "createAgent",
        args: [displayName, emailHash],
      });

      // Extract new agentId from the AgentCreated event.
      let newId = 0n;
      for (const log of receipt.logs) {
        try {
          const parsed = decodeEventLog({
            abi: agentRegistry.abi as unknown as never,
            data: log.data,
            topics: log.topics,
          }) as unknown as { eventName: string; args: { agentId?: bigint } };
          if (parsed.eventName === "AgentCreated") {
            newId = (parsed.args.agentId ?? 0n) as bigint;
            break;
          }
        } catch {
          // not our event
        }
      }
      await Promise.all([refetchId(), refetchAgent()]);
      return newId;
    },
    [sendTransaction, refetchId, refetchAgent],
  );

  const updateDisplayName = useCallback(
    async (name: string) => {
      await sendTransaction({
        address: agentRegistry.address,
        abi: agentRegistry.abi as unknown as never,
        functionName: "updateDisplayName",
        args: [agentId, name],
      });
      await refetchAgent();
    },
    [sendTransaction, agentId, refetchAgent],
  );

  return {
    agentId: hasAgent ? agentId : undefined,
    hasAgent,
    agent,
    isPending: idPending || (hasAgent && agentPending),
    createAgent,
    updateDisplayName,
    refetch: () => Promise.all([refetchId(), refetchAgent()]),
  };
}
