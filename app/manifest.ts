import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes GhostPay installable and MiniPay-friendly (mobile-first,
 * standalone display, Celo-yellow theme).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GhostPay — Pay-as-you-go AI on Celo",
    short_name: "GhostPay",
    description:
      "Your onchain AI agent on Celo. Pay per LLM call in cUSD — no subscription. Built for MiniPay.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0C10",
    theme_color: "#FBCB0A",
    icons: [
      { src: "/logo.jpg", sizes: "480x360", type: "image/jpeg", purpose: "any" },
    ],
  };
}
