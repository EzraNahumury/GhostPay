import { expect } from "chai";
import { ethers } from "hardhat";

describe("PaymentLog", () => {
  const AMT = ethers.parseUnits("5", 18);

  async function deploy() {
    const [owner, sender, recipient, stranger] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    const cusd = await Token.deploy("Celo Dollar", "cUSD", 18);
    await cusd.waitForDeployment();
    await cusd.mint(sender.address, ethers.parseUnits("100", 18));

    const Registry = await ethers.getContractFactory("AgentRegistry");
    const reg = await Registry.deploy();
    await reg.waitForDeployment();
    await reg.connect(sender).createAgent("S", ethers.keccak256(ethers.toUtf8Bytes("s@x.io")));

    const Payment = await ethers.getContractFactory("PaymentLog");
    const pay = await Payment.deploy(await reg.getAddress());
    await pay.waitForDeployment();

    return { owner, sender, recipient, stranger, cusd, reg, pay };
  }

  it("moves real tokens and logs a truthful receipt", async () => {
    const { sender, recipient, cusd, pay } = await deploy();
    await cusd.connect(sender).approve(await pay.getAddress(), ethers.MaxUint256);

    await expect(
      pay.connect(sender).pay(1, await cusd.getAddress(), recipient.address, AMT, "rent", "")
    ).to.emit(pay, "PaymentSettled");

    expect(await cusd.balanceOf(recipient.address)).to.equal(AMT);
    expect(await pay.count(1)).to.equal(1n);
    const r = await pay.receiptAt(1, 0);
    expect(r.amount).to.equal(AMT);
    expect(r.recipient).to.equal(recipient.address);
    expect(r.status).to.equal(1n); // Completed
  });

  it("reverts if the caller has not approved (no silent fake receipt)", async () => {
    const { sender, recipient, cusd, pay } = await deploy();
    await expect(
      pay.connect(sender).pay(1, await cusd.getAddress(), recipient.address, AMT, "x", "")
    ).to.be.reverted; // ERC20 insufficient allowance -> no receipt written
    expect(await pay.count(1)).to.equal(0n);
  });

  it("rejects unauthorized senders", async () => {
    const { stranger, recipient, cusd, pay } = await deploy();
    await expect(
      pay.connect(stranger).pay(1, await cusd.getAddress(), recipient.address, AMT, "x", "")
    ).to.be.revertedWithCustomError(pay, "NotAuthorized");
  });
});
