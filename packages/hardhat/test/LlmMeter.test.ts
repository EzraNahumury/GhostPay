import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("LlmMeter (escrow + refund, multi-token)", () => {
  const PRICE = ethers.parseUnits("0.01", 18); // 0.01 stable per call

  async function deploy() {
    const [owner, user, treasury, other] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const cusd = await Token.deploy("Celo Dollar", "cUSD", 18);
    await cusd.waitForDeployment();
    await cusd.mint(user.address, ethers.parseUnits("100", 18));

    // a second accepted token with different decimals (like USDC)
    const usdc = await Token.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();
    await usdc.mint(user.address, ethers.parseUnits("100", 6));

    const Registry = await ethers.getContractFactory("AgentRegistry");
    const reg = await Registry.deploy();
    await reg.waitForDeployment();
    await reg.connect(user).createAgent("U", ethers.keccak256(ethers.toUtf8Bytes("u@x.io")));

    const Meter = await ethers.getContractFactory("LlmMeter");
    const meter = await Meter.deploy(await reg.getAddress(), treasury.address, [
      await cusd.getAddress(),
      await usdc.getAddress(),
    ]);
    await meter.waitForDeployment();

    await cusd.connect(user).approve(await meter.getAddress(), ethers.MaxUint256);
    await usdc.connect(user).approve(await meter.getAddress(), ethers.MaxUint256);
    const token = await cusd.getAddress();
    return { owner, user, treasury, other, cusd, usdc, token, reg, meter };
  }

  const reqId = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

  it("escrows funds on pay (treasury not yet credited)", async () => {
    const { user, treasury, token, cusd, meter } = await deploy();
    await expect(meter.connect(user).payForCall(1, reqId("r1"), token, PRICE, "gpt-4o"))
      .to.emit(meter, "UsagePaid");
    expect(await cusd.balanceOf(await meter.getAddress())).to.equal(PRICE);
    expect(await cusd.balanceOf(treasury.address)).to.equal(0n);
    expect(await meter.isPending(reqId("r1"))).to.equal(true);
  });

  it("operator settle releases escrow to treasury", async () => {
    const { owner, user, treasury, token, cusd, meter } = await deploy();
    await meter.connect(user).payForCall(1, reqId("r2"), token, PRICE, "gpt-4o");
    await expect(meter.connect(owner).settle(reqId("r2")))
      .to.emit(meter, "UsageSettled")
      .withArgs(reqId("r2"), 1, token, PRICE);
    expect(await cusd.balanceOf(treasury.address)).to.equal(PRICE);
    expect(await meter.spentByAgentToken(1, token)).to.equal(PRICE);
    expect(await meter.callsByAgent(1)).to.equal(1n);
    expect(await meter.statusOf(reqId("r2"))).to.equal(2);
  });

  it("operator refund returns escrow to payer (LLM failed)", async () => {
    const { owner, user, token, cusd, meter } = await deploy();
    const before = await cusd.balanceOf(user.address);
    await meter.connect(user).payForCall(1, reqId("r3"), token, PRICE, "gpt-4o");
    await expect(meter.connect(owner).refund(reqId("r3")))
      .to.emit(meter, "UsageRefunded")
      .withArgs(reqId("r3"), user.address, token, PRICE);
    expect(await cusd.balanceOf(user.address)).to.equal(before);
    expect(await meter.callsByAgent(1)).to.equal(0n);
  });

  it("accepts a different token (USDC, 6 decimals)", async () => {
    const { owner, user, treasury, usdc, meter } = await deploy();
    const usdcAddr = await usdc.getAddress();
    const price6 = ethers.parseUnits("0.01", 6);
    await meter.connect(user).payForCall(1, reqId("u1"), usdcAddr, price6, "gpt-4o");
    await meter.connect(owner).settle(reqId("u1"));
    expect(await usdc.balanceOf(treasury.address)).to.equal(price6);
    expect(await meter.spentByAgentToken(1, usdcAddr)).to.equal(price6);
  });

  it("rejects a non-accepted token", async () => {
    const { user, meter } = await deploy();
    const Token = await ethers.getContractFactory("MockERC20");
    const rogue = await Token.deploy("Rogue", "RGE", 18);
    await rogue.waitForDeployment();
    await expect(
      meter.connect(user).payForCall(1, reqId("bad"), await rogue.getAddress(), PRICE, "gpt-4o"),
    ).to.be.revertedWithCustomError(meter, "TokenNotAccepted");
  });

  it("user self-refund blocked before timeout, allowed after", async () => {
    const { user, token, cusd, meter } = await deploy();
    await meter.connect(user).payForCall(1, reqId("r4"), token, PRICE, "gpt-4o");
    await expect(meter.connect(user).refund(reqId("r4")))
      .to.be.revertedWithCustomError(meter, "RefundTooEarly");
    await time.increase(15 * 60 + 1);
    const before = await cusd.balanceOf(user.address);
    await meter.connect(user).refund(reqId("r4"));
    expect(await cusd.balanceOf(user.address)).to.equal(before + PRICE);
  });

  it("non-operator cannot settle; cannot settle/refund twice", async () => {
    const { owner, user, other, token, meter } = await deploy();
    await meter.connect(user).payForCall(1, reqId("r5"), token, PRICE, "gpt-4o");
    await expect(meter.connect(other).settle(reqId("r5")))
      .to.be.revertedWithCustomError(meter, "NotOperator");
    await meter.connect(owner).settle(reqId("r5"));
    await expect(meter.connect(owner).refund(reqId("r5")))
      .to.be.revertedWithCustomError(meter, "NotPending");
  });

  it("blocks replay, unauthorized payer, and enforces min price", async () => {
    const { owner, user, other, token, cusd, meter } = await deploy();
    await meter.connect(user).payForCall(1, reqId("dup"), token, PRICE, "gpt-4o");
    await expect(meter.connect(user).payForCall(1, reqId("dup"), token, PRICE, "gpt-4o"))
      .to.be.revertedWithCustomError(meter, "Replayed");

    await cusd.mint(other.address, PRICE);
    await cusd.connect(other).approve(await meter.getAddress(), ethers.MaxUint256);
    await expect(meter.connect(other).payForCall(1, reqId("x"), token, PRICE, "gpt-4o"))
      .to.be.revertedWithCustomError(meter, "NotAuthorized");

    await meter.connect(owner).setMinPrice(token, "gpt-4o", PRICE);
    await expect(meter.connect(user).payForCall(1, reqId("low"), token, PRICE - 1n, "gpt-4o"))
      .to.be.revertedWithCustomError(meter, "BelowMinPrice");
  });

  it("supports single-signature permit escrow", async () => {
    const { user, token, cusd, meter } = await deploy();
    const meterAddr = await meter.getAddress();
    const chainId = Number((await ethers.provider.getNetwork()).chainId);
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const nonce = await cusd.nonces(user.address);
    const domain = { name: "Celo Dollar", version: "1", chainId, verifyingContract: token };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const value = { owner: user.address, spender: meterAddr, value: ethers.MaxUint256, nonce, deadline };
    const sig = await user.signTypedData(domain, types, value);
    const { v, r, s } = ethers.Signature.from(sig);

    await meter.connect(user).payForCallWithPermit(
      1, reqId("permit"), token, PRICE, "gpt-4o", ethers.MaxUint256, deadline, v, r, s
    );
    expect(await meter.isPending(reqId("permit"))).to.equal(true);
    expect(await cusd.balanceOf(meterAddr)).to.equal(PRICE);
  });
});
