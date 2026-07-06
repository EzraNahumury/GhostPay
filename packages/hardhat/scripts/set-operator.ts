import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Set the LlmMeter escrow operator (settle/refund signer). Owner-only.
 *   NEW_OPERATOR=0x... npx hardhat run scripts/set-operator.ts --network celo
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const op = process.env.NEW_OPERATOR;
  if (!op || !ethers.isAddress(op)) throw new Error("Set NEW_OPERATOR to a valid address");

  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "celo.json"), "utf8"));
  const meter = await ethers.getContractAt("LlmMeter", d.contracts.LlmMeter, deployer);

  const current = await meter.operator();
  console.log("current operator:", current);
  if (current.toLowerCase() === op.toLowerCase()) {
    console.log("already set — nothing to do");
    return;
  }
  const tx = await meter.setOperator(ethers.getAddress(op));
  console.log("setOperator tx:", tx.hash);
  await tx.wait();
  console.log("✓ operator now:", await meter.operator());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
