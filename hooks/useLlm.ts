"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { parseUnits, keccak256, toHex } from "viem";
import { llmMeter, erc20Abi } from "@/lib/contracts";
import type { TokenInfo } from "@/lib/constants";
import { useCustomWallet } from "@/contexts/CustomWallet";

export interface LlmModel {
  id: string;
  label: string;
  /** Price per call in USD (converted to the chosen token's decimals). */
  price: number;
}

/** Available models and their per-call price (in USD ≈ 1 stablecoin unit). */
export const LLM_MODELS: LlmModel[] = [
  { id: "gpt-4o-mini", label: "GPT-4o mini (fast, cheap)", price: 0.01 },
  { id: "gpt-4o", label: "GPT-4o (smart)", price: 0.05 },
];

export type LlmStep = "idle" | "paying" | "generating" | "done" | "error";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function randomRequestId(): `0x${string}` {
  const rand = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(rand).map((b) => b.toString(16).padStart(2, "0")).join("");
  return keccak256(toHex(`${hex}-${Date.now()}`));
}

/**
 * Pay-as-you-go LLM: each call escrows the chosen stablecoin on-chain via
 * LlmMeter; the backend settles on success or refunds on failure.
 */
export function useLlm(agentId: bigint | undefined) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransaction } = useCustomWallet();

  const [step, setStep] = useState<LlmStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [refundable, setRefundable] = useState<`0x${string}` | null>(null);

  // Number of settled calls for this agent (multi-token → count, not a sum).
  const { data: callsRaw, refetch: refetchCalls } = useReadContract({
    ...llmMeter,
    functionName: "callsByAgent",
    args: agentId ? [agentId] : undefined,
    query: { enabled: Boolean(agentId) },
  });
  const calls = Number((callsRaw as bigint | undefined) ?? 0n);

  const ensureAllowance = useCallback(
    async (token: TokenInfo, needed: bigint) => {
      if (!address || !publicClient) throw new Error("Wallet not ready");
      const allowance = (await publicClient.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, llmMeter.address],
      })) as bigint;
      if (allowance < needed) {
        // Approve a generous allowance once to avoid an approve per call.
        const max = parseUnits("1000000", token.decimals);
        await sendTransaction({
          address: token.address,
          abi: erc20Abi as unknown as never,
          functionName: "approve",
          args: [llmMeter.address, max],
        });
      }
    },
    [address, publicClient, sendTransaction],
  );

  /**
   * Pay in the chosen token, then fetch the completion.
   * @returns assistant reply string
   */
  const ask = useCallback(
    async (model: LlmModel, token: TokenInfo, messages: ChatMessage[]): Promise<string> => {
      if (!agentId) throw new Error("Create an agent first");
      setError(null);
      const price = parseUnits(model.price.toString(), token.decimals);
      const requestId = randomRequestId();

      try {
        setStep("paying");
        await ensureAllowance(token, price);
        const receipt = await sendTransaction({
          address: llmMeter.address,
          abi: llmMeter.abi as unknown as never,
          functionName: "payForCall",
          args: [agentId, requestId, token.address, price, model.id],
        });
        setLastTxHash(receipt.transactionHash);

        setStep("generating");
        const res = await fetch("/api/llm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId, model: model.id, messages }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          if (!j.refunded) setRefundable(requestId);
          throw new Error(j.error ?? `LLM request failed (${res.status})`);
        }
        const json = await res.json();
        setStep("done");
        setRefundable(null);
        await refetchCalls();
        return json.content as string;
      } catch (e) {
        if (step === "generating") setRefundable(requestId);
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        setStep("error");
        throw e;
      }
    },
    [agentId, ensureAllowance, sendTransaction, refetchCalls, step],
  );

  /**
   * Reclaim a stuck escrow for a failed call. Succeeds immediately if the
   * backend already refunded is skipped; otherwise after REFUND_TIMEOUT (15 min).
   */
  const selfRefund = useCallback(async () => {
    if (!refundable) return;
    await sendTransaction({
      address: llmMeter.address,
      abi: llmMeter.abi as unknown as never,
      functionName: "refund",
      args: [refundable],
    });
    setRefundable(null);
  }, [refundable, sendTransaction]);

  return { ask, step, error, lastTxHash, calls, refundable, selfRefund, refetchCalls };
}
