import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Verify all deployed GhostPay contracts on Celoscan.
 * Reads addresses from deployments/<network>.json. Requires CELOSCAN_API_KEY.
 *   npx hardhat run scripts/verify.ts --network celo
 */
async function main() {
  const netFile = path.join(__dirname, "..", "deployments", "celo.json");
  const d = JSON.parse(fs.readFileSync(netFile, "utf8"));
  const c = d.contracts;

  const verify = async (address: string, args: unknown[]) => {
    try {
      await run("verify:verify", { address, constructorArguments: args });
      console.log("✓ verified", address);
    } catch (e) {
      console.warn("• skip", address, "→", (e as Error).message.split("\n")[0]);
    }
  };

  await verify(c.AgentRegistry, []);
  await verify(c.PaymentLog, [c.AgentRegistry]);
  await verify(c.MemoryVault, [c.AgentRegistry]);
  await verify(c.Compliance, [c.AgentRegistry]);
  await verify(c.LlmMeter, [c.AgentRegistry, d.treasury, d.payTokens]);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
