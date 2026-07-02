/**
 * constants — single source of truth for GhostPay on Celo.
 *
 * Contract addresses are injected via NEXT_PUBLIC_* env vars (written by the
 * Hardhat deploy script, or set in Vercel). Token addresses are the canonical
 * Celo stablecoins.
 */

import { celo } from "wagmi/chains";
import { celoSepolia } from "@/config/wagmi";

// ── Active network ────────────────────────────────────────────────────────

export const ACTIVE_CHAIN_ID =
  (process.env.NEXT_PUBLIC_CELO_NETWORK ?? "celo") === "celoSepolia"
    ? celoSepolia.id
    : celo.id;

// ── Canonical Celo mainnet tokens ─────────────────────────────────────────

/**
 * USDm (Mento Dollar) — 18 decimals, EIP-2612 permit. Default pay token.
 * This is the former cUSD contract; Celo/Mento rebranded cUSD → "Mento Dollar (USDm)".
 * Same address, same token — MiniPay users also pay gas in it.
 */
export const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

/** Native USDC on Celo — 6 decimals. */
export const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

/** USD₮ (Tether) on Celo — 6 decimals. */
export const USDT_ADDRESS = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";

/**
 * CELO native token — exposed as an ERC-20 (GoldToken), 18 decimals.
 * Lets users pay with native CELO through the same approve+transferFrom flow.
 * Note: the CELO ERC-20 does NOT support EIP-2612 permit, so CELO uses the
 * approve path only (the chat/payments flows already do).
 */
export const CELO_ADDRESS = "0x471EcE3750Da237f93B8E339c536989b8978a438";

export interface TokenInfo {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
}

/** Celo mainnet stablecoins (matches MiniPay's USD stables). */
const STABLES: TokenInfo[] = [
  { symbol: "USDm", name: "Mento Dollar", address: USDM_ADDRESS as `0x${string}`, decimals: 18 },
  { symbol: "USDC", name: "USD Coin", address: USDC_ADDRESS as `0x${string}`, decimals: 6 },
  { symbol: "USDT", name: "Tether USD", address: USDT_ADDRESS as `0x${string}`, decimals: 6 },
];

/** CELO native (as ERC-20) — selectable for payments/LLM. */
export const CELO_TOKEN: TokenInfo = {
  symbol: "CELO",
  name: "Celo",
  address: CELO_ADDRESS as `0x${string}`,
  decimals: 18,
};

/** Every selectable token, keyed by symbol (used for receipt symbol lookups). */
export const TOKENS: Record<string, TokenInfo> = Object.fromEntries(
  [...STABLES, CELO_TOKEN].map((t) => [t.symbol, t]),
);

/** Stablecoin rows for wallet/balances (native CELO is shown separately). */
export const TOKEN_LIST = STABLES;

/** Tokens the user can pay with (LLM + payments): stablecoins + native CELO. */
export const PAY_TOKENS: TokenInfo[] = [...STABLES, CELO_TOKEN];

/** Default pay token (env override by symbol, else USDm). */
export const PAY_TOKEN: TokenInfo =
  TOKENS[process.env.NEXT_PUBLIC_PAY_TOKEN_SYMBOL ?? ""] ?? STABLES[0];

// ── GhostPay contract addresses (from deploy script / env) ─────────────────

const z = "0x0000000000000000000000000000000000000000" as const;

export const CONTRACTS = {
  AgentRegistry: (process.env.NEXT_PUBLIC_AGENT_REGISTRY ?? z) as `0x${string}`,
  PaymentLog: (process.env.NEXT_PUBLIC_PAYMENT_LOG ?? z) as `0x${string}`,
  MemoryVault: (process.env.NEXT_PUBLIC_MEMORY_VAULT ?? z) as `0x${string}`,
  Compliance: (process.env.NEXT_PUBLIC_COMPLIANCE ?? z) as `0x${string}`,
  LlmMeter: (process.env.NEXT_PUBLIC_LLM_METER ?? z) as `0x${string}`,
} as const;

/** True once contracts are configured (not the zero address). */
export const CONTRACTS_DEPLOYED = CONTRACTS.AgentRegistry !== z;

// ── Explorer ───────────────────────────────────────────────────────────────

export function explorerTxUrl(hash: string): string {
  const base =
    ACTIVE_CHAIN_ID === celoSepolia.id ? "https://sepolia.celoscan.io" : "https://celoscan.io";
  return `${base}/tx/${hash}`;
}

export function explorerAddrUrl(addr: string): string {
  const base =
    ACTIVE_CHAIN_ID === celoSepolia.id ? "https://sepolia.celoscan.io" : "https://celoscan.io";
  return `${base}/address/${addr}`;
}
