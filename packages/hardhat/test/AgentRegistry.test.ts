import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentRegistry", () => {
  async function deploy() {
    const [owner, alice, bob] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("AgentRegistry");
    const reg = await Registry.deploy();
    await reg.waitForDeployment();
    return { reg, owner, alice, bob };
  }

  const emailHash = ethers.keccak256(ethers.toUtf8Bytes("alice@example.com"));

  it("mints an agent as an ERC-721 owned by the creator", async () => {
    const { reg, alice } = await deploy();
    await expect(reg.connect(alice).createAgent("Alice Agent", emailHash))
      .to.emit(reg, "AgentCreated");
    expect(await reg.totalAgents()).to.equal(1n);
    expect(await reg.ownerOf(1)).to.equal(alice.address);
    const a = await reg.agents(1);
    expect(a.displayName).to.equal("Alice Agent");
    expect(a.active).to.equal(true);
  });

  it("only owner can update / deactivate", async () => {
    const { reg, alice, bob } = await deploy();
    await reg.connect(alice).createAgent("A", emailHash);
    await expect(reg.connect(bob).updateDisplayName(1, "hax"))
      .to.be.revertedWithCustomError(reg, "NotAgentOwner");
    await reg.connect(alice).updateDisplayName(1, "A2");
    expect((await reg.agents(1)).displayName).to.equal("A2");
    await reg.connect(alice).deactivateAgent(1);
    expect(await reg.isActive(1)).to.equal(false);
  });

  it("grantCapability treats the argument as a DURATION (Sui bug fix)", async () => {
    const { reg, alice, bob } = await deploy();
    await reg.connect(alice).createAgent("A", emailHash);

    const durationMs = 60_000; // 60s
    const tx = await reg.connect(alice).grantCapability(1, bob.address, durationMs);
    const receiptTs = (await ethers.provider.getBlock((await tx.wait())!.blockNumber))!.timestamp;

    const expiry = await reg.capExpiry(1, bob.address);
    // expiry == now + 60s, NOT an absolute timestamp echoed back
    expect(Number(expiry)).to.be.closeTo(receiptTs + 60, 2);
    expect(await reg.isAuthorized(1, bob.address)).to.equal(true);
  });

  it("capability expires and revokes correctly", async () => {
    const { reg, alice, bob } = await deploy();
    await reg.connect(alice).createAgent("A", emailHash);
    await reg.connect(alice).grantCapability(1, bob.address, 60_000);
    expect(await reg.isAuthorized(1, bob.address)).to.equal(true);

    await time.increase(61);
    expect(await reg.isAuthorized(1, bob.address)).to.equal(false);

    // re-grant then revoke
    await reg.connect(alice).grantCapability(1, bob.address, 60_000);
    expect(await reg.isAuthorized(1, bob.address)).to.equal(true);
    await reg.connect(alice).revokeCapability(1, bob.address);
    expect(await reg.isAuthorized(1, bob.address)).to.equal(false);
  });

  it("rejects zero-duration grants and respects pause", async () => {
    const { reg, owner, alice, bob } = await deploy();
    await reg.connect(alice).createAgent("A", emailHash);
    await expect(reg.connect(alice).grantCapability(1, bob.address, 0))
      .to.be.revertedWithCustomError(reg, "ZeroDuration");

    await reg.connect(owner).setPaused(true);
    await expect(reg.connect(bob).createAgent("B", emailHash))
      .to.be.revertedWithCustomError(reg, "ContractPaused");
  });
});
