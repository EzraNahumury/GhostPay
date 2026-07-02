"use client";

import { useCallback } from "react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { paymentLog, erc20Abi } from "@/lib/contracts";
import { TOKENS, type TokenInfo } from "@/lib/constants";
import { useCustomWallet } from "@/contexts/CustomWallet";

const STATUS = ["Pending", "Completed", "Refunded", "Failed"] as const;

export interface PaymentView {
  seq: number;
  ts: number;
  amount: number;
  token: `0x${string}`;
  tokenSymbol: string;
  recipient: `0x${string}`;
  memo: string;
  status: string;
}

function symbolFor(addr: string): TokenInfo | undefined {
  return Object.values(TOKENS).find((t) => t.address.toLowerCase() === addr.toLowerCase());
}

export function usePayments(agentId: bigint | undefined) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransaction } = useCustomWallet();

  const { data: raw, refetch, isPending } = useReadContract({
    ...paymentLog,
    functionName: "recent",
    args: agentId ? [agentId, 25n] : undefined,
    query: { enabled: Boolean(agentId) },
  });

  const payments: PaymentView[] = ((raw as unknown[]) ?? []).map((r) => {
    const rec = r as {
      ts: bigint; amount: bigint; token: `0x${string}`;
      recipient: `0x${string}`; memo: string; status: number; cid: string;
    };
    const info = symbolFor(rec.token);
    const decimals = info?.decimals ?? 18;
    return {
      seq: 0,
      ts: Number(rec.ts) * 1000,
      amount: Number(formatUnits(rec.amount, decimals)),
      token: rec.token,
      tokenSymbol: info?.symbol ?? "TOKEN",
      recipient: rec.recipient,
      memo: rec.memo,
      status: STATUS[rec.status] ?? "Unknown",
    };
  });

  const pay = useCallback(
    async (params: {
      token: TokenInfo;
      recipient: `0x${string}`;
      amount: number;
      memo: string;
    }) => {
      if (!agentId) throw new Error("Create an agent first");
      if (!address || !publicClient) throw new Error("Wallet not ready");
      const amt = parseUnits(params.amount.toString(), params.token.decimals);

      // ensure allowance for PaymentLog to pull the tokens
      const allowance = (await publicClient.readContract({
        address: params.token.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, paymentLog.address],
      })) as bigint;
      if (allowance < amt) {
        await sendTransaction({
          address: params.token.address,
          abi: erc20Abi as unknown as never,
          functionName: "approve",
          args: [paymentLog.address, amt],
        });
      }

      const receipt = await sendTransaction({
        address: paymentLog.address,
        abi: paymentLog.abi as unknown as never,
        functionName: "pay",
        args: [agentId, params.token.address, params.recipient, amt, params.memo, ""],
      });
      await refetch();
      return receipt;
    },
    [agentId, address, publicClient, sendTransaction, refetch],
  );

  return { payments, isPending, pay, refetch };
}
