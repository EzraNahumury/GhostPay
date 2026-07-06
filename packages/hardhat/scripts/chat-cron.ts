import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * chat-cron — one cron CYCLE of on-chain AI-chat activity.
 *
 * Each invocation:
 *   1. picks a DYNAMIC count N in [WALLETS_MIN, WALLETS_MAX] (default 27..48),
 *   2. for each of N: creates a BRAND-NEW wallet, funds it from the main wallet,
 *      then that fresh wallet self-authorizes (createAgent) and runs ONE real
 *      AI-chat payment: LlmMeter.payForCall(agentId, requestId, CELO, 0.001, model).
 *
 * The fresh wallet is thrown away after its single chat tx — the next cron cycle
 * mints new wallets again. Run this 4x/day via Windows Task Scheduler (see
 * scripts/run-chat-cron.cmd) to spread ~150 unique-wallet AI-chat txs across a day.
 *
 *   npx hardhat run scripts/chat-cron.ts --network celo
 *
 * Env (all optional):
 *   WALLETS_MIN=27  WALLETS_MAX=48   dynamic range per cycle
 *   CALL_PRICE=0.001                 CELO paid per chat (matches hooks/useLlm.ts)
 *   MODEL=meta-llama/llama-3.3-70b-instruct:free
 */

const CELO_TOKEN = "0x471EcE3750Da237f93B8E339c536989b8978a438"; // native CELO as ERC-20 (18 dec)
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
];

const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
];

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

async function main() {
  const provider = ethers.provider;
  const [main] = await ethers.getSigners();

  const d = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"),
  );
  const registryAddr: string = d.contracts.AgentRegistry;
  const meterAddr: string = d.contracts.LlmMeter;

  const registryAbi = (await ethers.getContractFactory("AgentRegistry")).interface;
  const meterAbi = (await ethers.getContractFactory("LlmMeter")).interface;

  const WALLETS_MIN = Number(process.env.WALLETS_MIN ?? 27);
  const WALLETS_MAX = Number(process.env.WALLETS_MAX ?? 48);
  const CALL_PRICE = process.env.CALL_PRICE ?? "0.001";
  const price = ethers.parseUnits(CALL_PRICE, 18); // CELO has 18 decimals

  const n = randInt(WALLETS_MIN, WALLETS_MAX);

  // Gas strategy for the throwaway wallet:
  //   An EIP-1559 tx requires balance >= gasLimit * maxFeePerGas to even submit,
  //   NOT just the actual cost. If we fund at the effective price but the wallet
  //   auto-picks the node's maxFeePerGas (~2x baseFee), it can't reserve enough
  //   and later txs fail. So we PIN maxFeePerGas ourselves to a tight cap and give
  //   each tx an explicit gasLimit. Reservation then == what we fund → minimal
  //   dust burned in the dead wallet. Every over-funded wei is lost (wallet dies).
  const effPrice = BigInt(await provider.send("eth_gasPrice", [])); // baseFee + tip
  const fee = await provider.getFeeData();
  const feeCap = (effPrice * 12n) / 10n; // +20% headroom for baseFee drift between blocks
  let tip = fee.maxPriorityFeePerGas ?? ethers.parseUnits("2", "gwei");
  if (tip > feeCap) tip = feeCap;
  const feeOverrides = { maxFeePerGas: feeCap, maxPriorityFeePerGas: tip };

  // Fund from a safe UPPER BOUND on total gas; each tx auto-estimates its own
  // gasLimit at send time (so none can out-of-gas), while feeCap keeps the
  // per-tx reservation tight. freshGas just sizes the wallet's funding.
  //   createAgent ~180k + approve ~46k + payForCall (struct + model string) ~210k
  const freshGas = 500000n; // upper bound for funding the 3 fresh-wallet txs
  const fund = price + freshGas * feeCap; // covers reservations + the 0.001 payment
  const mainFundGas = 21000n; // main pays this per wallet to send the funding tx

  const startBal = await provider.getBalance(main.address);
  console.log("── chat-cron cycle ──────────────────────────────────────────");
  console.log("network      :", network.name, "chainId", (await provider.getNetwork()).chainId);
  console.log("main wallet  :", main.address);
  console.log("main balance :", ethers.formatEther(startBal), "CELO");
  // Two figures:
  //   gross  = up-front outflow per wallet before sweep returns dust (fund + fund-tx gas)
  //   net    = what the main wallet actually loses per wallet AFTER sweep-back:
  //            real gas of ~5 txs at the EFFECTIVE price + the 0.001 escrow.
  const gross = fund + mainFundGas * feeCap;
  const sweeping = process.env.SWEEP !== "0";
  const netGas = 480000n; // measured: create+approve+pay+sweep+fund-tx ≈ 480k gas
  const perWalletNet = sweeping ? netGas * effPrice + price : gross;
  console.log("gas price    :", ethers.formatUnits(effPrice, "gwei"), "gwei eff / cap", ethers.formatUnits(feeCap, "gwei"));
  console.log("wallets      :", n, `(dynamic ${WALLETS_MIN}..${WALLETS_MAX})`);
  console.log("price / chat :", CALL_PRICE, "CELO   fund / wallet:", ethers.formatEther(fund), "CELO");
  console.log("sweep-back   :", sweeping ? "on (dust reclaimed)" : "OFF (dust burned)");
  console.log("net / wallet :", ethers.formatEther(perWalletNet), "CELO");
  console.log("est. cycle   :", ethers.formatEther(perWalletNet * BigInt(n)), "CELO (net)");
  console.log("──────────────────────────────────────────────────────────────");

  if (startBal < gross * BigInt(n)) {
    console.error("!! main balance too low for", n, "wallets — top up or lower WALLETS_MAX");
    process.exitCode = 1;
    return;
  }

  if (process.env.DRY_RUN === "1") {
    const perDay = 4;
    const avg = (WALLETS_MIN + WALLETS_MAX) / 2;
    const dayCost = perWalletNet * BigInt(Math.round(avg)) * BigInt(perDay);
    console.log("DRY_RUN — no transactions sent.");
    console.log(`this cycle would mint ${n} wallets, ~${ethers.formatEther(perWalletNet * BigInt(n))} CELO (net)`);
    console.log(`at ${perDay} cycles/day, avg ${avg} wallets → ~${ethers.formatEther(dayCost)} CELO/day`);
    if (dayCost > 0n) {
      console.log(`balance ${ethers.formatEther(startBal)} CELO lasts ~${startBal / dayCost} days at THIS gas`);
    }
    return;
  }

  let ok = 0;

  for (let i = 0; i < n; i++) {
    const w = ethers.Wallet.createRandom().connect(provider);
    const tag = `[${i + 1}/${n}] ${w.address.slice(0, 10)}…`;
    try {
      // 1) fund the fresh wallet (main pays). Sequential awaits → auto-nonce is safe.
      const fundTx = await main.sendTransaction({ to: w.address, value: fund });
      await fundTx.wait(1);

      // 2) fresh wallet self-authorizes: mint its own agent
      const registry = new ethers.Contract(registryAddr, registryAbi, w);
      const emailHash = ethers.keccak256(ethers.toUtf8Bytes(`${w.address}@ghostpay.app`));
      const cTx = await registry.createAgent("cron-agent", emailHash, feeOverrides);
      await cTx.wait(1);
      const agentId: bigint = await registry.primaryAgentOf(w.address);

      // 3) approve CELO for the meter
      const celo = new ethers.Contract(CELO_TOKEN, ERC20_ABI, w);
      const aTx = await celo.approve(meterAddr, price, feeOverrides);
      await aTx.wait(1);

      // 4) THE AI-CHAT TX — escrow 0.001 CELO for one call
      const meter = new ethers.Contract(meterAddr, meterAbi, w);
      const requestId = ethers.hexlify(ethers.randomBytes(32));
      const pTx = await meter.payForCall(agentId, requestId, CELO_TOKEN, price, pick(MODELS), feeOverrides);
      await pTx.wait(1);

      // 5) sweep leftover CELO back to main (else it's burned in the dead wallet).
      //    Skip with SWEEP=0. Keeps only the gas for this one transfer.
      let swept = 0n;
      if (process.env.SWEEP !== "0") {
        const bal = await provider.getBalance(w.address);
        const keep = 21000n * feeCap; // reserve exactly this sweep tx's gas
        if (bal > keep) {
          const value = bal - keep;
          const sTx = await w.sendTransaction({ to: main.address, value, gasLimit: 21000n, ...feeOverrides });
          await sTx.wait(1);
          swept = value;
        }
      }

      ok++;
      console.log(`${tag} ✓ agent#${agentId} chat ${pTx.hash}${swept > 0n ? ` (swept ${ethers.formatEther(swept)})` : ""}`);
    } catch (e) {
      console.warn(`${tag} ✗ ${(e as Error).message.split("\n")[0]}`);
    }
  }

  const spent = startBal - (await provider.getBalance(main.address));
  console.log("──────────────────────────────────────────────────────────────");
  console.log(`done: ${ok}/${n} chat txs · spent ${ethers.formatEther(spent)} CELO this cycle`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
