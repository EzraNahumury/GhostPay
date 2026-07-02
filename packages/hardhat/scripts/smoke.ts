import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Smoke test on the live network: create the deployer's agent (idempotent).
 * Produces the project's first real on-chain transaction.
 *   npx hardhat run scripts/smoke.ts --network celo
 */
async function main() {
  const [signer] = await ethers.getSigners();
  const d = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"),
  );
  const registry = await ethers.getContractAt("AgentRegistry", d.contracts.AgentRegistry, signer);

  const existing: bigint = await registry.primaryAgentOf(signer.address);
  if (existing > 0n) {
    console.log("Agent already exists for", signer.address, "→ id", existing.toString());
    return;
  }

  const emailHash = ethers.keccak256(ethers.toUtf8Bytes("deployer@ghostpay.app"));
  console.log("Creating agent from", signer.address, "…");
  const tx = await registry.createAgent("GhostPay Genesis Agent", emailHash);
  console.log("tx:", tx.hash);
  const rcpt = await tx.wait();
  const id: bigint = await registry.primaryAgentOf(signer.address);
  console.log("✓ agent created — id", id.toString(), "block", rcpt?.blockNumber);
  console.log("explorer:", `https://celoscan.io/tx/${tx.hash}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
