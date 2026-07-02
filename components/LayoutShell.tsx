"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Wallet,
  Send,
  Database,
  Shield,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
  WifiOff,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCustomWallet } from "@/contexts/CustomWallet";
import { motion, AnimatePresence } from "framer-motion";
import { DemoErrorBoundary, useNetworkStatus } from "@/lib/demoProof";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "AI Chat", icon: Sparkles },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/payments", label: "Payments", icon: Send },
  { href: "/vault", label: "Vault", icon: Database },
  { href: "/compliance", label: "Compliance", icon: Shield },
];

const sidebarVariants = {
  expanded: { width: 240 },
  collapsed: { width: 64 },
};

function short(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected, address, connectWallet, logout, isMiniPayWallet, correctChain, ensureCorrectChain } =
    useCustomWallet();
  const { online } = useNetworkStatus();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMobileMenuOpen(false), [pathname]);

  const WalletButton = () =>
    !mounted ? (
      <div className="h-9 w-28" />
    ) : isConnected ? (
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] text-sm text-[#F4F6FF] hover:bg-[rgba(255,255,255,0.08)]">
            <span className="w-2 h-2 rounded-full bg-[#35D07F]" />
            <span className="font-mono text-xs">{short(address)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-56 bg-[#0B0C10] border border-[rgba(255,255,255,0.05)] p-2">
          {!correctChain && (
            <Button variant="ghost" className="w-full justify-start text-[#FBCB0A] hover:bg-[rgba(255,255,255,0.05)]" onClick={ensureCorrectChain}>
              Switch to Celo
            </Button>
          )}
          <Button variant="ghost" className="w-full justify-start text-left text-[#F4F6FF] hover:bg-[rgba(255,255,255,0.05)]" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2 text-[#A7B0C8]" />
            Disconnect
          </Button>
        </PopoverContent>
      </Popover>
    ) : isMiniPayWallet ? (
      // Inside MiniPay the wallet is injected + auto-connected — no manual button.
      <span className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#A7B0C8]">
        <span className="w-2 h-2 rounded-full bg-[#FBCB0A] animate-pulse" />
        Connecting MiniPay…
      </span>
    ) : (
      <Button
        onClick={connectWallet}
        size="sm"
        className="gap-2 bg-[#FBCB0A] text-[#0B0C10] hover:brightness-110 transition rounded-full font-semibold px-5"
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </Button>
    );

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0C10] text-[#F4F6FF] font-sans">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-[#0B0C10] lg:hidden"
          >
            <div className="flex h-full flex-col">
              <div className="flex h-16 items-center justify-between px-6 border-b border-[rgba(255,255,255,0.05)]">
                <Link href="/dashboard" className="font-heading font-semibold">
                  Ghost<span className="text-[#FBCB0A]">Pay</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        isActive
                          ? "bg-[rgba(251,203,10,0.12)] text-[#FBCB0A]"
                          : "text-[#A7B0C8] hover:text-[#F4F6FF] hover:bg-[rgba(255,255,255,0.05)]",
                      )}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-[rgba(255,255,255,0.05)]">
                <WalletButton />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        animate={sidebarOpen ? "expanded" : "collapsed"}
        variants={sidebarVariants}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="hidden lg:flex flex-col bg-[#0B0C10] overflow-hidden"
      >
        <div className={cn("flex h-16 items-center", sidebarOpen ? "px-6 justify-between" : "px-4 justify-center")}>
          {sidebarOpen ? (
            <>
              <Link href="/dashboard" className="font-heading font-semibold">
                Ghost<span className="text-[#FBCB0A]">Pay</span>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-[#A7B0C8]">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-[#A7B0C8]">
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  sidebarOpen ? "" : "justify-center",
                  isActive
                    ? "bg-[rgba(251,203,10,0.12)] text-[#FBCB0A]"
                    : "text-[#A7B0C8] hover:text-[#F4F6FF] hover:bg-[rgba(255,255,255,0.05)]",
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        {sidebarOpen && (
          <div className="p-3">
            <WalletButton />
          </div>
        )}
      </motion.aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-4 bg-[#0B0C10]/80 backdrop-blur-xl px-4 lg:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <Link href="/dashboard" className="font-heading font-semibold text-sm">
              Ghost<span className="text-[#FBCB0A]">Pay</span>
            </Link>
          </div>
          <div className="flex-1" />
          <WalletButton />
        </header>

        {mounted && isConnected && !correctChain && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-[#FBCB0A]/90 text-[#0B0C10] text-sm font-medium">
            Wrong network.
            <button className="underline" onClick={ensureCorrectChain}>
              Switch to Celo
            </button>
          </div>
        )}

        {!online && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-destructive/90 text-destructive-foreground text-sm font-medium">
            <WifiOff className="w-4 h-4" />
            You are offline.
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-[#0B0C10]">
          <div className="animate-page-in">
            <DemoErrorBoundary>{children}</DemoErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0B0C10]/95 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all",
                  isActive ? "text-[#FBCB0A]" : "text-[#A7B0C8] hover:text-[#F4F6FF]",
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
