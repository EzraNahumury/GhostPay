import { http } from "wagmi";
import { celo } from "wagmi/chains";
import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

/**
 * Celo Sepolia testnet — defined manually to avoid viem version drift.
 */
export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
  },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://sepolia.celoscan.io" },
  },
  testnet: true,
});

const defaultChainName = process.env.NEXT_PUBLIC_CELO_NETWORK ?? "celo";
export const activeChain = defaultChainName === "celoSepolia" ? celoSepolia : celo;

/**
 * wagmi + RainbowKit config.
 *
 * RainbowKit's getDefaultConfig bundles injected + WalletConnect + Coinbase etc.
 * MiniPay injects `window.ethereum` (isMiniPay=true) and is picked up by the
 * injected connector — auto-connected in CustomWalletProvider. WalletConnect
 * (for external mobile wallets) needs a projectId from https://cloud.reown.com;
 * injected/MiniPay works without it.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "GhostPay",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "ghostpay_dev_placeholder",
  chains: [celo, celoSepolia],
  transports: {
    [celo.id]: http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? "https://forno.celo.org"),
    [celoSepolia.id]: http(
      process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL ??
        "https://forno.celo-sepolia.celo-testnet.org",
    ),
  },
  ssr: true,
});

/** True when running inside the MiniPay in-app browser. */
export function isMiniPay(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Boolean((window as any).ethereum?.isMiniPay);
}

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
