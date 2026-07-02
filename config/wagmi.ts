import { http, createConfig, createStorage } from "wagmi";
import { celo } from "wagmi/chains";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";

/**
 * Celo Sepolia testnet — defined manually to avoid viem version drift.
 * Faucet: CELO + test USDC/EURC from the Celo faucet.
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
 * wagmi config.
 *
 * MiniPay note: MiniPay injects an EIP-1193 provider (`window.ethereum`) and
 * marks it with `isMiniPay === true`. The `injected` connector auto-detects it.
 * Inside MiniPay we auto-connect and hide every other wallet option; outside
 * MiniPay the same injected connector works with any browser wallet.
 */
export const wagmiConfig = createConfig({
  chains: [celo, celoSepolia],
  connectors: [
    injected({ shimDisconnect: true }),
  ],
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    key: "ghostpay.wagmi",
  }),
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
