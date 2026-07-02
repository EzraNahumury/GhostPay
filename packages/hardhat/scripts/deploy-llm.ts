import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * One-off: deploy ONLY LlmMeter against an already-deployed AgentRegistry.
 * Used after the main deploy partially completed. Normalizes token addresses
 * (lowercase -> EIP-55 checksum) so a bad-checksum env value can't block it.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const registry = ethers.getAddress("0x718664652C3A7eb6A2c23D8986338a237087d7CD");
  const treasury =
    process.env.TREASURY_ADDRESS && process.env.TREASURY_ADDRESS.trim().length > 0
      ? ethers.getAddress(process.env.TREASURY_ADDRESS.trim())
      : deployer.address;
  const payTokens = (process.env.PAY_TOKENS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ethers.getAddress(s.toLowerCase())); // normalize checksum

  console.log("network :", network.name);
  console.log("registry:", registry);
  console.log("treasury:", treasury);
  console.log("payTokens:", payTokens.join(", "));

  const LlmMeter = await ethers.getContractFactory("LlmMeter");
  const meter = await LlmMeter.deploy(registry, treasury, payTokens);
  await meter.waitForDeployment();
  const llmAddr = await meter.getAddress();
  console.log("LlmMeter:", llmAddr);

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    payTokens,
    treasury,
    contracts: {
      AgentRegistry: registry,
      PaymentLog: ethers.getAddress("0xC4324810Dd67f3a939b5E1c1Daa195B17e9d6c33"),
      MemoryVault: ethers.getAddress("0xA099404ab9e323c97f536c3cd7b4fA55C0c1ce79"),
      Compliance: ethers.getAddress("0x5501E661e791Ca501A16E414dd345DD423FCE95f"),
      LlmMeter: llmAddr,
    },
    deployedAt: new Date().toISOString(),
  };

  const deployDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deployDir, { recursive: true });
  fs.writeFileSync(path.join(deployDir, `${network.name}.json`), JSON.stringify(out, null, 2));
  const feConfig = path.join(__dirname, "..", "..", "..", "config");
  fs.mkdirSync(feConfig, { recursive: true });
  fs.writeFileSync(path.join(feConfig, `deployments.${network.name}.json`), JSON.stringify(out, null, 2));

  console.log("\nAll addresses written to deployments/" + network.name + ".json");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
