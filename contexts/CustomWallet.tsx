"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWriteContract,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import type { Abi, TransactionReceipt } from "viem";
import { wagmiConfig, activeChain, isMiniPay } from "@/config/wagmi";
import { useAuthentication } from "./Authentication";
import { UserRole } from "@/types/Authentication";
import { toast } from "sonner";

interface WriteParams {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: readonly any[];
  value?: bigint;
}

interface CustomWalletContextProps {
  isConnected: boolean;
  address?: `0x${string}`;
  isMiniPayWallet: boolean;
  chainId?: number;
  correctChain: boolean;
  connectWallet: () => Promise<void>;
  ensureCorrectChain: () => Promise<void>;
  /** Write a contract call, wait for the receipt, return it. Throws on revert. */
  sendTransaction: (params: WriteParams) => Promise<TransactionReceipt>;
  logout: () => void;
}

export const useCustomWallet = () => useContext(CustomWalletContext);

export const CustomWalletContext = createContext<CustomWalletContextProps>({
  isConnected: false,
  address: undefined,
  isMiniPayWallet: false,
  chainId: undefined,
  correctChain: false,
  connectWallet: async () => {},
  ensureCorrectChain: async () => {},
  sendTransaction: async () => {
    throw new Error("Not implemented");
  },
  logout: () => {},
});

export default function CustomWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { handleLoginAs } = useAuthentication();

  const isMiniPayWallet = useMemo(() => isMiniPay(), []);
  const correctChain = chainId === activeChain.id;

  const injectedConnector = useMemo(
    () => connectors.find((c) => c.id === "injected") ?? connectors[0],
    [connectors],
  );

  const connectWallet = useCallback(async () => {
    if (!injectedConnector) {
      toast.error("No wallet found. Open in MiniPay or install a Celo wallet.");
      return;
    }
    try {
      await connectAsync({ connector: injectedConnector, chainId: activeChain.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect wallet";
      toast.error(msg);
      throw err;
    }
  }, [connectAsync, injectedConnector]);

  // MiniPay: auto-connect the injected provider on load.
  useEffect(() => {
    if (isMiniPayWallet && !isConnected && injectedConnector) {
      connectAsync({ connector: injectedConnector, chainId: activeChain.id }).catch(() => {});
    }
  }, [isMiniPayWallet, isConnected, injectedConnector, connectAsync]);

  // Mirror wallet identity into the (provider-agnostic) Authentication context.
  useEffect(() => {
    if (isConnected && address) {
      const storedRole = sessionStorage.getItem("userRole");
      handleLoginAs({
        firstName: "Celo",
        lastName: "User",
        role: storedRole && storedRole !== "null" ? (storedRole as UserRole) : "anonymous",
        email: address,
        picture: "",
      });
    }
  }, [isConnected, address, handleLoginAs]);

  const ensureCorrectChain = useCallback(async () => {
    if (chainId !== activeChain.id) {
      await switchChainAsync({ chainId: activeChain.id });
    }
  }, [chainId, switchChainAsync]);

  const sendTransaction = useCallback(
    async (params: WriteParams): Promise<TransactionReceipt> => {
      if (!isConnected) throw new Error("Wallet not connected");
      await ensureCorrectChain();
      const hash = await writeContractAsync({
        chainId: activeChain.id,
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args as never,
        value: params.value,
      });
      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash,
        chainId: activeChain.id,
      });
      if (receipt.status === "reverted") {
        throw new Error(`Transaction reverted: ${hash}`);
      }
      return receipt;
    },
    [isConnected, ensureCorrectChain, writeContractAsync],
  );

  const logout = useCallback(() => {
    disconnect();
    sessionStorage.clear();
    window.location.href = "/";
  }, [disconnect]);

  return (
    <CustomWalletContext.Provider
      value={{
        isConnected,
        address,
        isMiniPayWallet,
        chainId,
        correctChain,
        connectWallet,
        ensureCorrectChain,
        sendTransaction,
        logout,
      }}
    >
      {children}
    </CustomWalletContext.Provider>
  );
}

// Re-export so hooks can grab the public client / wallet client if needed.
export { usePublicClient, useWalletClient };
