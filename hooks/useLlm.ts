"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { parseUnits, keccak256, toHex } from "viem";
import { llmMeter, erc20Abi } from "@/lib/contracts";
import type { TokenInfo } from "@/lib/constants";
import { useCustomWallet } from "@/contexts/CustomWallet";

export interface LlmModel {
  id: string;
  label: string;
}

/** Flat GhostPay fee per call (in stablecoin units, USD-ish). Models are free. */
export const CALL_PRICE = 0.01;

/** Fallback list if the provider's /models can't be reached. */
export const FALLBACK_MODELS: LlmModel[] = [
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B" },
  { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash" },
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
 * LlmMeter; the backend settles on success or refunds on failure. Model list is
 * fetched live from the provider (free models only).
 */
export function useLlm(agentId: bigint | undefined) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransaction } = useCustomWallet();

  const [step, setStep] = useState<LlmStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [refundable, setRefundable] = useState<`0x${string}` | null>(null);
  const [models, setModels] = useState<LlmModel[]>(FALLBACK_MODELS);
  const [modelsLoading, setModelsLoading] = useState(true);

  // Load free models from the provider.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/models")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (Array.isArray(j.models) && j.models.length > 0) setModels(j.models);
      })
      .catch(() => {})
      .finally(() => !cancelled && setModelsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

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

  const ask = useCallback(
    async (model: LlmModel, token: TokenInfo, messages: ChatMessage[]): Promise<string> => {
      if (!agentId) throw new Error("Create an agent first");
      setError(null);
      const price = parseUnits(CALL_PRICE.toString(), token.decimals);
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

  return {
    ask,
    step,
    error,
    lastTxHash,
    calls,
    models,
    modelsLoading,
    refundable,
    selfRefund,
    refetchCalls,
  };
}
