import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("network :", network.name);
  console.log("deployer:", deployer.address);
  console.log("balance :", ethers.formatEther(bal), "CELO");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
