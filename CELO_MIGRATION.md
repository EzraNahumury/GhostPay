# GhostPay → Celo Migration Blueprint

**Target:** Celo Proof of Ship S2 (MiniApp for MiniPay, Celo mainnet, verified contracts).
**Scope:** Full feature port (agent / payment / memory / compliance) + primary use-case **pay-as-you-go LLM**.
**Stack rule:** viem + wagmi ONLY (never ethers.js in MiniPay).

---

## 0. Why this is a rewrite, not a config swap

Sui = Move + object model. Celo = EVM/Solidity (L2 Ethereum). Zero on-chain reuse.
All Sui-specific infra has NO drop-in equivalent:

| Sui primitive | Celo replacement |
|---|---|
| Move objects (owned/child) | Solidity mappings/structs; Agent = ERC-721 |
| zkLogin (Enoki) | MiniPay injected wallet (+ optional Privy social) |
| Enoki sponsored tx | Celo fee-in-cUSD (native) / optional ERC-4337 paymaster |
| DeepBook V3 CLOB | Mento (stable↔stable) / Uniswap v3 on Celo |
| Walrus blob store | IPFS (Pinata/Lighthouse) or Arweave |
| SEAL threshold enc + `seal_approve` | Lit Protocol (EVM access-control conditions) |
| `subscribeEvent` (FluxStream) | viem `watchContractEvent` / The Graph / Ponder |

**Reuse (~70-80%):** `components/` (UI, landing, layout), `lib/agentEngine.ts` (rule engine, TS-pure), `lib/demoProof.tsx`, page structure, product narrative.
**Delete:** `move/`, all `use*Transaction`/`use*Query` hooks, `contexts/CustomWallet.tsx`, `app/api/*` (Enoki), `SealService.ts`, `WalrusService.ts`, `DeepBookService.ts`, `constants.ts`, `config/networkConfig.ts`.

---

## 1. Solidity contract design (Move → EVM)

Package `ghostpay/` (Hardhat, Celo-Composer). Deploy to Celo mainnet, verify on Celoscan.

### 1.1 AgentRegistry.sol  (← agent.move)
Agent as **ERC-721** (agentId = tokenId → ownable, transferable, matches "agent = object" narrative).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentRegistry is ERC721, Ownable {
    struct Agent {
        string  displayName;
        bytes32 emailHash;     // keccak256(email); Move stored SHA256 string
        uint64  createdAt;
        uint64  paymentSeq;    // monotonic; incremented by PaymentLog
        uint64  memorySeq;     // incremented by MemoryVault
        bool    active;
    }
    uint256 public totalAgents;
    bool    public paused;
    mapping(uint256 => Agent) public agents;
    // delegation (← AgentCap)
    mapping(uint256 => mapping(address => uint64)) public capExpiry; // agentId => grantee => expiresAt

    event AgentCreated(uint256 indexed agentId, address indexed owner, uint64 createdAt);
    event AgentUpdated(uint256 indexed agentId, string newName);
    event AgentDeactivated(uint256 indexed agentId);
    event CapabilityGranted(uint256 indexed agentId, address indexed grantee, uint64 expiresAt);

    modifier onlyAgentOwner(uint256 id){ require(ownerOf(id)==msg.sender,"not owner"); _; }

    function createAgent(string calldata name, bytes32 emailHash) external returns(uint256 id){
        require(!paused,"paused");
        id = ++totalAgents;
        _safeMint(msg.sender, id);
        agents[id] = Agent(name, emailHash, uint64(block.timestamp), 0, 0, true);
        emit AgentCreated(id, msg.sender, uint64(block.timestamp));
    }
    function updateDisplayName(uint256 id, string calldata n) external onlyAgentOwner(id){
        require(agents[id].active,"inactive"); agents[id].displayName=n; emit AgentUpdated(id,n);
    }
    function deactivate(uint256 id) external onlyAgentOwner(id){ agents[id].active=false; emit AgentDeactivated(id); }
    function grantCapability(uint256 id, address grantee, uint64 durationMs) external onlyAgentOwner(id){
        // FIX Sui bug: treat as DURATION, expiry = now + duration
        uint64 exp = uint64(block.timestamp) + durationMs/1000;
        capExpiry[id][grantee]=exp; emit CapabilityGranted(id,grantee,exp);
    }
    function isAuthorized(uint256 id, address who) public view returns(bool){
        return ownerOf(id)==who || capExpiry[id][who] >= block.timestamp;
    }
    // package-internal seq bumps exposed to trusted modules
    function bumpPaymentSeq(uint256 id) external returns(uint64){ /* onlyModule */ return ++agents[id].paymentSeq; }
    function bumpMemorySeq(uint256 id)  external returns(uint64){ /* onlyModule */ return ++agents[id].memorySeq; }
}
```
Notes: fixes the `grant_capability` duration bug from the Sui audit. `onlyModule` guard needed on seq bumps (registry knows PaymentLog/MemoryVault addresses).

### 1.2 PaymentLog.sol  (← payment.move) — REAL value transfer
Sui `record_payment` only logged metadata + lied `status="completed"`. On Celo, **actually move cUSD/USDC** in the same tx.

```solidity
contract PaymentLog {
    IERC20 public immutable cUSD;
    AgentRegistry public reg;
    struct Receipt { uint64 seq; uint64 ts; uint256 amount; address token; address recipient; string memo; uint8 status; string cid; }
    mapping(uint256 => Receipt[]) public receipts; // agentId => receipts
    event PaymentSettled(uint256 indexed agentId, uint64 seq, uint256 amount, address token, address recipient);

    // pull tokens from sender, forward to recipient, log receipt — atomic
    function pay(uint256 agentId, address token, address recipient, uint256 amount, string calldata memo, string calldata cid) external {
        require(reg.isAuthorized(agentId,msg.sender),"unauth");
        require(amount>0,"zero");
        IERC20(token).transferFrom(msg.sender, recipient, amount);   // requires prior approve/permit
        uint64 seq = reg.bumpPaymentSeq(agentId);
        receipts[agentId].push(Receipt(seq,uint64(block.timestamp),amount,token,recipient,memo,1,cid));
        emit PaymentSettled(agentId,seq,amount,token,recipient);
    }
}
```
UX: use **EIP-2612 permit** (cUSD/USDC support it) so approve+pay is one signature — smoother in MiniPay.

### 1.3 MemoryVault.sol  (← memory.move) — IPFS pointer
```solidity
contract MemoryVault {
    AgentRegistry public reg;
    struct Record { uint64 seq; string cid; string dataType; uint64 ts; uint8 visibility; uint64 size; string label; }
    mapping(uint256 => Record[]) public records;
    event MemoryStored(uint256 indexed agentId, uint64 seq, string cid, string dataType);
    event VisibilityChanged(uint256 indexed agentId, uint64 seq, uint8 v);

    function store(uint256 id, string calldata cid, string calldata dt, uint8 vis, uint64 size, string calldata label) external {
        require(reg.isAuthorized(id,msg.sender),"unauth");
        uint64 seq = reg.bumpMemorySeq(id);
        records[id].push(Record(seq,cid,dt,uint64(block.timestamp),vis,size,label));
        emit MemoryStored(id,seq,cid,dt);
    }
}
```
`cid` = IPFS content id (blob previously encrypted client-side via Lit).

### 1.4 Compliance.sol  (← compliance.move)
On-chain grant/revoke + access log events. Actual decryption gating via **Lit access-control** referencing these grants (Lit can read EVM contract state).

```solidity
contract Compliance {
    AgentRegistry public reg;
    struct ViewKey { address viewer; string label; uint64 createdAt; uint64 expiresAt; bool active; }
    mapping(uint256 => ViewKey[]) public viewKeys;
    event ViewKeyCreated(uint256 indexed agentId, uint256 idx, address viewer, uint64 expiresAt);
    event ViewKeyRevoked(uint256 indexed agentId, uint256 idx);
    event DataAccessed(uint256 indexed agentId, address viewer, string dataRef);

    function createViewKey(uint256 id, address viewer, string calldata label, uint64 durMs) external {
        require(reg.ownerOf(id)==msg.sender,"not owner");
        uint64 exp=uint64(block.timestamp)+durMs/1000;
        viewKeys[id].push(ViewKey(viewer,label,uint64(block.timestamp),exp,true));
        emit ViewKeyCreated(id, viewKeys[id].length-1, viewer, exp);
    }
    function canView(uint256 id, address who) external view returns(bool){
        ViewKey[] storage ks=viewKeys[id];
        for(uint i;i<ks.length;i++) if(ks[i].active && ks[i].viewer==who && ks[i].expiresAt>=block.timestamp) return true;
        return false;
    }
}
```

### 1.5 LlmMeter.sol  (NEW — pay-as-you-go core)
Each LLM/image call = one on-chain cUSD micro-payment. **Drives tx count + fees + unique users = exactly Proof of Ship scoring.**

```solidity
contract LlmMeter {
    IERC20 public immutable cUSD;
    address public treasury;
    AgentRegistry public reg;
    mapping(bytes32 => bool) public served;          // requestId => paid (replay guard)
    mapping(uint256 => uint256) public spentByAgent; // usage analytics
    event UsagePaid(uint256 indexed agentId, address indexed user, bytes32 requestId, uint256 amount, string model);

    // called per LLM request; permit lets it be a single signature
    function payForCall(uint256 agentId, bytes32 requestId, uint256 amount, string calldata model) external {
        require(reg.isAuthorized(agentId,msg.sender),"unauth");
        require(!served[requestId],"replay");
        served[requestId]=true;
        cUSD.transferFrom(msg.sender, treasury, amount);
        spentByAgent[agentId]+=amount;
        emit UsagePaid(agentId,msg.sender,requestId,amount,model);
    }
}
```
Backend LLM proxy: verify `UsagePaid` event (or `served[requestId]`) before returning completion. Prepaid-escrow variant possible later, but per-call on-chain is BETTER for score.

---

## 2. Off-chain service replacements

| Sui service | Celo module | How |
|---|---|---|
| `WalrusService.ts` | `IpfsService.ts` | Pinata/Lighthouse pin API; `cid` → contract; gateway URL for read |
| `SealService.ts` | `LitService.ts` | Lit `encryptToJson` w/ EVM access conditions (owner OR `Compliance.canView`); decrypt via session sig |
| `DeepBookService.ts` | `MentoService.ts` / `SwapService.ts` | Mento SDK for cUSD↔cEUR↔cREAL; Uniswap v3 router for token↔cUSD |
| `EnokiClient` + `/api/sponsor` + `/api/execute` | **deleted** | MiniPay pays gas in cUSD natively; no sponsor backend (kills the JWT auth hole too) |
| `useFluxStream` | `useContractEvents` | viem `watchContractEvent` on PaymentSettled/UsagePaid; or The Graph subgraph |

`lib/agentEngine.ts` — **keep**. Rewrite only the action executor tail (`executeAgentAction`) to build viem tx instead of Sui PTB. Action types (`swap/transfer/record_payment/store_memory`) map cleanly. Add `llm_call` action.

---

## 3. Frontend rewire

- **Wallet layer:** replace `contexts/CustomWallet.tsx` with wagmi config + MiniPay connector.
  - Detect MiniPay: `window.ethereum?.isMiniPay === true` → auto-connect injected, hide other connectors.
  - Chain: Celo mainnet (42220), Celo Sepolia (11142220) for test.
- **Providers:** swap `@mysten/dapp-kit` `WalletProvider`/`SuiClientProvider` for `WagmiProvider` + `QueryClientProvider` (keep React Query).
- **Hooks:** rewrite all `use*Transaction`/`use*Query` on `useWriteContract`/`useReadContract`/`useWatchContractEvent`.
- **Amounts:** cUSD/USDC = 18 decimals on Celo (cUSD is 18, USDC bridged is 6 — check per token). Sui code assumed 9/6; audit every decimal.
- **Balances:** ERC-20 `balanceOf` via multicall (viem) instead of `getBalance`/coinDiscovery.
- **UI reuse:** landing, layout, vault/payments/compliance/dashboard pages keep structure; rip Sui imports.

---

## 4. Dev + deploy

1. `npx @celo/celo-composer create` → Next + Hardhat + Vercel scaffold w/ MiniPay hook.
2. Port contracts (§1) into `packages/hardhat`. OpenZeppelin ERC721/ERC20/permit.
3. Test on **Celo Sepolia** (faucet: CELO + test USDC/EURC).
4. Deploy Celo **mainnet** + `hardhat verify` (Celoscan) — eligibility requirement.
5. Frontend on Vercel; test inside MiniPay (site tester / ngrok).
6. Register on talent.app, add repo + contract address, enroll Proof of Ship.

---

## 5. Carry-over fixes from Sui audit (do NOT re-import)

- ❌ JWT-without-signature auth hole — **gone** (no sponsor backend on Celo). If any backend added (LLM proxy), use SIWE (Sign-In With Ethereum) + verify signature.
- ✅ `grant_capability` now duration-based (fixed in AgentRegistry).
- ✅ payment status no longer lies — cUSD actually moves in `pay()`.
- ✅ package IDs → single deployed address per contract, wired via env; no stale hardcoded constants.
- ⚠️ README overclaims (AI/yield-vault/PQ/encrypted-reasoning) — rewrite honest for Celo submission.
- ⚠️ `tests/` Sui scratch scripts — delete; add Hardhat tests (also boosts GitHub activity score).

---

## 6. Effort (full port)

| Phase | Work | Est |
|---|---|---|
| Contracts | 5 Solidity contracts + Hardhat tests + deploy/verify | 1.5–2 wk |
| Services | IPFS, Lit, Mento/swap, event indexer | 1–1.5 wk |
| Frontend | wagmi/MiniPay rewire, all hooks, decimals audit | 1.5–2 wk |
| Polish | agentEngine executor, LLM proxy, honest README, demo | 1 wk |
| **Total** | | **~5–6.5 wk solo** |

Proof of Ship is monthly + weekly leaderboard → ship LlmMeter + AgentRegistry + PaymentLog first (drives onchain metrics), add MemoryVault/Compliance in later sprint weeks.
