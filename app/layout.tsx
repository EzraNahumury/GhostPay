import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ProvidersAndLayout } from "./ProvidersAndLayout";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GhostPay — Pay-as-you-go AI Agent on Celo",
  description:
    "Your onchain AI agent on Celo. Pay per LLM call in cUSD — no subscription. Built for MiniPay.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/logo.jpg" }],
    shortcut: ["/logo.jpg"],
    apple: [{ url: "/logo.jpg" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "GhostPay" },
  other: {
    "talentapp:project_verification":
      "e519a0b1272d6096eae1536665938bc601038c2ecd0d197eb4559ba24a1493f0a10ecf7f5274ad0860a42be9710f760a07e7c0d015f41063d3ff81ce7ba5c4d2",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0C10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}
    >
      <body className={inter.className} suppressHydrationWarning>
        <ProvidersAndLayout>{children}</ProvidersAndLayout>
      </body>
    </html>
  );
}
