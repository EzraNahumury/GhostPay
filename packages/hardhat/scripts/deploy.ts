import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys the full GhostPay contract suite to the selected Celo network.
 *
 * Order:
 *   1. AgentRegistry            (identity, ERC-721)
 *   2. PaymentLog(registry)     (real cUSD/USDC payments + receipts)
 *   3. MemoryVault(registry)    (IPFS pointers)
 *   4. Compliance(registry)     (view-keys read by Lit)
 *   5. LlmMeter(payToken, registry, treasury)  (pay-as-you-go LLM)
 *
 * Writes deployed addresses to ./deployments/<network>.json AND to the
 * frontend at ../../config/deployments.<network>.json so the app can import them.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const net = network.name;
  console.log(`Deploying GhostPay to ${net} as ${deployer.address}`);

  // Accepted pay tokens for LlmMeter (comma-separated). Falls back to PAY_TOKEN_ADDRESS.
  const payTokens = (process.env.PAY_TOKENS ?? process.env.PAY_TOKEN_ADDRESS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const treasury = process.env.TREASURY_ADDRESS ?? deployer.address;
  if (payTokens.length === 0) {
    throw new Error("PAY_TOKENS (or PAY_TOKEN_ADDRESS) is required — accepted stablecoin address(es).");
  }

  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("AgentRegistry:", registryAddr);

  const PaymentLog = await ethers.getContractFactory("PaymentLog");
  const paymentLog = await PaymentLog.deploy(registryAddr);
  await paymentLog.waitForDeployment();
  const paymentAddr = await paymentLog.getAddress();
  console.log("PaymentLog:", paymentAddr);

  const MemoryVault = await ethers.getContractFactory("MemoryVault");
  const memoryVault = await MemoryVault.deploy(registryAddr);
  await memoryVault.waitForDeployment();
  const memoryAddr = await memoryVault.getAddress();
  console.log("MemoryVault:", memoryAddr);

  const Compliance = await ethers.getContractFactory("Compliance");
  const compliance = await Compliance.deploy(registryAddr);
  await compliance.waitForDeployment();
  const complianceAddr = await compliance.getAddress();
  console.log("Compliance:", complianceAddr);

  const LlmMeter = await ethers.getContractFactory("LlmMeter");
  const llmMeter = await LlmMeter.deploy(registryAddr, treasury, payTokens);
  await llmMeter.waitForDeployment();
  const llmAddr = await llmMeter.getAddress();
  console.log("LlmMeter:", llmAddr, "accepted tokens:", payTokens.join(", "));

  // Point the escrow operator (settle/refund signer) at the backend key if given.
  const operatorAddr = process.env.OPERATOR_ADDRESS;
  if (operatorAddr && operatorAddr.toLowerCase() !== deployer.address.toLowerCase()) {
    const tx = await llmMeter.setOperator(operatorAddr);
    await tx.wait();
    console.log("LlmMeter operator set to:", operatorAddr);
  }

  const out = {
    network: net,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    payTokens,
    treasury,
    contracts: {
      AgentRegistry: registryAddr,
      PaymentLog: paymentAddr,
      MemoryVault: memoryAddr,
      Compliance: complianceAddr,
      LlmMeter: llmAddr,
    },
    deployedAt: new Date().toISOString(),
  };

  const deployDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deployDir, { recursive: true });
  fs.writeFileSync(path.join(deployDir, `${net}.json`), JSON.stringify(out, null, 2));

  // Mirror to frontend config so the Next.js app can import addresses.
  const feConfig = path.join(__dirname, "..", "..", "..", "config");
  try {
    fs.mkdirSync(feConfig, { recursive: true });
    fs.writeFileSync(path.join(feConfig, `deployments.${net}.json`), JSON.stringify(out, null, 2));
  } catch (e) {
    console.warn("Could not mirror deployment to frontend config:", (e as Error).message);
  }

  console.log("\nDeployment complete. Addresses written to deployments/" + net + ".json");
  console.log("Verify with:\n  npx hardhat verify --network " + net + " " + registryAddr);
  console.log("  npx hardhat verify --network " + net + " " + paymentAddr + " " + registryAddr);
  console.log("  npx hardhat verify --network " + net + " " + memoryAddr + " " + registryAddr);
  console.log("  npx hardhat verify --network " + net + " " + complianceAddr + " " + registryAddr);
  console.log(
    "  # LlmMeter has an array arg — verify with a constructor-args file:\n" +
      "  npx hardhat verify --network " + net + " --constructor-args verify-llmmeter.js " + llmAddr,
  );

  // Best-effort auto-verify (skips local networks).
  if (net === "celo" || net === "celoSepolia") {
    console.log("\nAttempting auto-verification in 20s...");
    await new Promise((r) => setTimeout(r, 20_000));
    const tryVerify = async (address: string, args: unknown[]) => {
      try {
        await run("verify:verify", { address, constructorArguments: args });
      } catch (e) {
        console.warn(`verify ${address} failed:`, (e as Error).message);
      }
    };
    await tryVerify(registryAddr, []);
    await tryVerify(paymentAddr, [registryAddr]);
    await tryVerify(memoryAddr, [registryAddr]);
    await tryVerify(complianceAddr, [registryAddr]);
    await tryVerify(llmAddr, [registryAddr, treasury, payTokens]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
