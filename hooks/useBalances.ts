"use client";

import { useAccount, useBalance, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { TOKEN_LIST } from "@/lib/constants";
import { Erc20Abi } from "@/lib/abis";

export interface TokenBalance {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  raw: bigint;
  formatted: number;
}

/**
 * Reads native CELO + configured stablecoin balances for the connected wallet.
 */
export function useBalances() {
  const { address } = useAccount();

  const { data: celoBal, refetch: refetchCelo } = useBalance({
    address,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  const { data: erc20Data, refetch: refetchErc20, isPending } = useReadContracts({
    allowFailure: true,
    contracts: TOKEN_LIST.map((t) => ({
      address: t.address,
      abi: Erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? [address] : undefined,
    })),
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  const tokens: TokenBalance[] = TOKEN_LIST.map((t, i) => {
    const raw = (erc20Data?.[i]?.result as bigint | undefined) ?? 0n;
    return {
      symbol: t.symbol,
      address: t.address,
      decimals: t.decimals,
      raw,
      formatted: Number(formatUnits(raw, t.decimals)),
    };
  });

  const celo = {
    symbol: "CELO",
    raw: celoBal?.value ?? 0n,
    formatted: celoBal ? Number(formatUnits(celoBal.value, 18)) : 0,
  };

  const bySymbol = (s: string) => tokens.find((t) => t.symbol === s);

  return {
    celo,
    tokens,
    bySymbol,
    isPending,
    refetch: () => Promise.all([refetchCelo(), refetchErc20()]),
  };
}
