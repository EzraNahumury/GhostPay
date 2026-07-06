"use client";
import "./mockStorage";

import React, { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/react";

import { wagmiConfig } from "@/config/wagmi";
import { AuthenticationProvider } from "@/contexts/Authentication";
import CustomWalletProvider from "@/contexts/CustomWallet";
import { ChildrenProps } from "@/types/ChildrenProps";
import { Toaster } from "@/components/ui/sonner";

export const ProvidersAndLayout = ({ children }: ChildrenProps) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize="compact"
          theme={darkTheme({
            accentColor: "#FBCB0A",
            accentColorForeground: "#0B0C10",
            borderRadius: "large",
            overlayBlur: "small",
          })}
        >
          <AuthenticationProvider>
            <CustomWalletProvider>
              <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
                <main>
                  {children}
                  <Toaster duration={2000} />
                  <Analytics />
                </main>
              </ThemeProvider>
            </CustomWalletProvider>
          </AuthenticationProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
