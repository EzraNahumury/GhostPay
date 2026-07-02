"use client";

import { useState } from "react";
import { Ghost, Wallet, Loader2 } from "lucide-react";
import { useCustomWallet } from "@/contexts/CustomWallet";
import { useAgent } from "@/hooks/useAgent";
import { CONTRACTS_DEPLOYED } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/**
 * Gates a page behind: wallet connected → agent created.
 * Renders a friendly connect / create flow otherwise.
 */
export default function AgentGate({ children }: { children: React.ReactNode }) {
  const { isConnected, connectWallet, isMiniPayWallet } = useCustomWallet();
  const { hasAgent, isPending, createAgent } = useAgent();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!CONTRACTS_DEPLOYED) {
    return (
      <Center>
        <Ghost className="w-12 h-12 text-[#FBCB0A]" />
        <h2 className="text-lg font-semibold">Contracts not configured</h2>
        <p className="text-sm text-[#A7B0C8] max-w-sm text-center">
          Deploy the GhostPay contracts to Celo and set the{" "}
          <code className="text-[#FBCB0A]">NEXT_PUBLIC_*</code> addresses in your env.
        </p>
      </Center>
    );
  }

  if (!isConnected) {
    return (
      <Center>
        <Ghost className="w-12 h-12 text-[#FBCB0A]" />
        <h2 className="text-lg font-semibold">Connect your wallet</h2>
        <p className="text-sm text-[#A7B0C8] max-w-sm text-center">
          {isMiniPayWallet
            ? "Connecting your MiniPay wallet…"
            : "Connect a Celo wallet (MiniPay, Valora, or any injected wallet) to continue."}
        </p>
        {/* No manual button inside MiniPay — the injected wallet auto-connects. */}
        {!isMiniPayWallet && (
          <Button onClick={connectWallet} className="gap-2 bg-[#FBCB0A] text-[#0B0C10] font-semibold rounded-full px-6">
            <Wallet className="w-4 h-4" /> Connect Wallet
          </Button>
        )}
      </Center>
    );
  }

  if (isPending) {
    return (
      <Center>
        <Loader2 className="w-8 h-8 animate-spin text-[#FBCB0A]" />
        <p className="text-sm text-[#A7B0C8]">Loading your agent…</p>
      </Center>
    );
  }

  if (!hasAgent) {
    return (
      <Center>
        <Ghost className="w-12 h-12 text-[#FBCB0A]" />
        <h2 className="text-lg font-semibold">Create your agent</h2>
        <p className="text-sm text-[#A7B0C8] max-w-sm text-center">
          Your agent is an onchain identity (an NFT you own) that pays for AI, sends cUSD, and
          remembers your data.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Input
            placeholder="Agent name (e.g. My Agent)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await createAgent(name.trim(), "");
                toast.success("Agent created!");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to create agent");
              } finally {
                setBusy(false);
              }
            }}
            className="gap-2 bg-[#FBCB0A] text-[#0B0C10] font-semibold"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ghost className="w-4 h-4" />}
            Create Agent
          </Button>
        </div>
      </Center>
    );
  }

  return <>{children}</>;
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 min-h-[70vh] px-6">
      {children}
    </div>
  );
}
