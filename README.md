# GhostPay — Pay-as-you-go AI Agent on Celo

> Built for Celo **Proof of Ship** · MiniApp for MiniPay · Celo mainnet

GhostPay gives every user an **onchain AI agent** on Celo. You pay **per LLM call** in your choice of Celo stablecoin — **USDm (Mento Dollar), USDC, or USDT** — no subscription. The same agent can send stablecoin payments, store documents on IPFS anchored onchain, and grant auditors time-boxed access. Built mobile-first for **MiniPay**.

## Why this fits Proof of Ship

- **Real onchain activity:** every AI call is a cUSD micro-payment settled onchain (`LlmMeter`), so normal usage generates transactions, fees, and unique active users — the exact metrics Proof of Ship scores.
- **MiniApp for MiniPay:** injected-wallet auto-connect, gas paid in cUSD, mobile-first UI.
- **Agentic use-case:** pay-as-you-go access to LLMs/image tools as an alternative to subscriptions (a use-case Celo explicitly calls out).

## How it works

1. Connect wallet (MiniPay auto-connects; any injected Celo wallet works).
2. Create your **agent** — an ERC-721 you own (`AgentRegistry`).
3. **Ask AI:** pick a stablecoin (USDm/USDC/USDT); each message escrows a small amount onchain (`LlmMeter.payForCall`). The server serves the completion, then **settles** the escrow to the treasury on success or **refunds** it on failure — you're never charged for a failed generation. If the backend is down, you can self-refund on-chain after a 15-minute timeout.
4. **Send money** in cUSD/USDC with an onchain receipt (`PaymentLog`).
5. **Vault:** upload documents to IPFS, anchor the CID onchain (`MemoryVault`).
6. **Compliance:** grant auditors a time-boxed view-key (`Compliance`), enforced onchain.

## Architecture

```
MiniPay / injected wallet ──> viem + wagmi ──> Next.js (App Router)
                                   │
   ┌───────────────────────────────┼─────────────────────────────┐
   │ Celo mainnet (Solidity)        │ Off-chain services           │
   │  AgentRegistry (ERC-721)       │  /api/llm  → LLM proxy       │
   │  PaymentLog (cUSD transfers)   │  /api/ipfs → Pinata pin      │
   │  MemoryVault (IPFS pointers)   │                              │
   │  Compliance (view-keys)        │  operator settles/refunds    │
   │  LlmMeter (escrow+refund)      │  LLM escrows                 │
   └────────────────────────────────────────────────────────────┘
```

- **Frontend:** Next.js, TypeScript, wagmi, viem, Tailwind, Radix.
- **Contracts:** Solidity 0.8.24, OpenZeppelin, Hardhat (`packages/hardhat`).
- **Storage:** IPFS via Pinata. **Payments/metering:** cUSD (EIP-2612 permit supported).

## Repo layout

```
packages/hardhat/     Solidity contracts + tests + deploy scripts
  contracts/          AgentRegistry, PaymentLog, MemoryVault, Compliance, LlmMeter
  test/               Hardhat tests (13 passing)
  scripts/deploy.ts   deploys the suite + writes addresses to the frontend
app/                  Next.js pages (dashboard, chat, wallet, payments, vault, compliance)
hooks/                wagmi hooks (useAgent, useLlm, usePayments, useMemories, useCompliance, useBalances)
lib/                  contracts.ts, abis.ts, IpfsService.ts, agentEngine.ts, constants.ts
config/wagmi.ts       Celo chains + MiniPay connector
```

## Getting started

### Contracts

```bash
cd packages/hardhat
cp .env.example .env          # set PRIVATE_KEY, PAY_TOKEN_ADDRESS, CELOSCAN_API_KEY
npm install
npm run compile
npm test                      # 13 passing
npm run deploy:sepolia        # or deploy:celo for mainnet (Proof of Ship eligibility)
```

Deploy writes contract addresses to `config/deployments.<network>.json` and prints the
`hardhat verify` commands for Celoscan.

### Frontend

```bash
cp .env.example .env.local    # set NEXT_PUBLIC_* contract addresses + PINATA_JWT + LLM_API_KEY
npm install
npm run dev
```

Test inside MiniPay using the MiniPay site tester (or ngrok) so the injected wallet connects.

## Networks

- **Mainnet:** Celo (chainId 42220) — required for Proof of Ship, contracts verified on Celoscan.
- **Testnet:** Celo Sepolia (chainId 11142220) — faucet provides CELO + test USDC/EURC.

## Honest scope

- The agent is a **deterministic rule engine** (`lib/agentEngine.ts`) plus an LLM proxy — no autonomous on-chain AI. The "AI" is the pay-per-call LLM the user drives.
- **Not audited.** Do not use with mainnet funds beyond small amounts. The LLM proxy tracks
  consumed `requestId`s in memory (per instance) for this MVP — back it with a shared store
  (Redis/KV) before scaling.
- Client-side encryption for private Vault files (Lit Protocol) is planned; today the CID is
  stored onchain and blobs should be encrypted before upload for sensitive data.

## License

MIT (contracts). Application code © the GhostPay team.
