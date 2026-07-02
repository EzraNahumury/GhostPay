/**
 * serverChain — viem public client for server routes (reads only).
 * Standalone (no wagmi imports) so it is safe in Node API routes.
 */
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] } },
  testnet: true,
});

const isSepolia = (process.env.NEXT_PUBLIC_CELO_NETWORK ?? "celo") === "celoSepolia";

export const serverChain = isSepolia ? celoSepolia : celo;

const rpcUrl = isSepolia
  ? process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL ?? "https://forno.celo-sepolia.celo-testnet.org"
  : process.env.NEXT_PUBLIC_CELO_RPC_URL ?? "https://forno.celo.org";

export const serverPublicClient = createPublicClient({
  chain: serverChain,
  transport: http(rpcUrl),
});

/**
 * Operator wallet client — settles/refunds LlmMeter escrows from the backend.
 * Returns null if OPERATOR_PRIVATE_KEY is unset (settle/refund then rely on the
 * user's post-timeout self-refund path instead).
 */
export function getOperatorWallet() {
  const pk = process.env.OPERATOR_PRIVATE_KEY;
  if (!pk) return null;
  const account = privateKeyToAccount(pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`));
  return createWalletClient({ account, chain: serverChain, transport: http(rpcUrl) });
}
