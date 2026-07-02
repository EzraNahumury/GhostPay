/*
 * Client-side config for GhostPay on Celo.
 * All values are public (NEXT_PUBLIC_*). Safe fallbacks — never throws at import
 * so the app builds even before contracts are deployed.
 */

const clientConfig = {
  /** "celo" (mainnet) or "celoSepolia" (testnet). */
  CELO_NETWORK: (process.env.NEXT_PUBLIC_CELO_NETWORK ?? "celo") as
    | "celo"
    | "celoSepolia",
  /** Default stablecoin symbol used for payments + LLM metering. */
  PAY_TOKEN_SYMBOL: process.env.NEXT_PUBLIC_PAY_TOKEN_SYMBOL ?? "cUSD",
  /** Public app URL (for links / share). */
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export default clientConfig;
