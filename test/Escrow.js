const { expect } = require("chai");
const { ethers } = require("hardhat");

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), "ether");
};

describe("Escrow", () => {
  let realEstate;
  let escrow;
  let buyer, seller, inspector, lender;
  let nftId;

  beforeEach(async () => {
    nftId = 1;
    [buyer, seller, inspector, lender] = await ethers.getSigners();
    const RealEstate = await ethers.getContractFactory("RealEstate");
    realEstate = await RealEstate.deploy();

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(
      realEstate.address,
      seller.address,
      inspector.address,
      lender.address
    );

    let transaction = await realEstate
      .connect(seller)
      .mint(
        "https://ipfs.io/ipfs/QmQUozrHLAusXDxrvsESJ3PYB3rUeUuBAvVWw6nop2uu7c/1.png"
      );
    await transaction.wait();

    transaction = await realEstate
      .connect(seller)
      .approve(escrow.address, nftId);
    await transaction.wait();
    transaction = await escrow
      .connect(seller)
      .list(nftId, buyer.address, tokens(10), tokens(5));
    await transaction.wait();
  });
  describe("Deployment", () => {
    it("Returns NFT address", async () => {
      let result = await escrow.nftAddress();
      expect(result).to.equal(realEstate.address);
    });
    it("Returns seller address", async () => {
      let result = await escrow.seller();
      expect(result).to.equal(seller.address);
    });
    it("Returns inspector address", async () => {
      let result = await escrow.inspector();
      expect(result).to.equal(inspector.address);
    });
    it("Returns lender address", async () => {
      let result = await escrow.lender();
      expect(result).to.equal(lender.address);
    });
  });

  describe("listing", () => {
    it("Only seller can list", async () => {
      await expect(
        escrow.connect(buyer).list(nftId, buyer.address, tokens(10), tokens(5))
      ).to.be.revertedWith("You are not the Seller");
    });

    it("updated as listed", async () => {
      const result = await escrow.isListed(nftId);
      expect(result).to.be.true;
    });

    it("updates ownership", async () => {
      expect(await realEstate.ownerOf(nftId)).to.equal(escrow.address);
    });

    it("Returns buyer", async () => {
      const result = await escrow.buyer(nftId);
      expect(result).to.equal(buyer.address);
    });
    it("Returns purchase price", async () => {
      const result = await escrow.purchasePrice(nftId);
      expect(result).to.equal(tokens(10));
    });
    it("returns escrow ammount", async () => {
      const result = await escrow.escrowAmount(nftId);
      expect(result).to.equal(tokens(5));
    });
  });

  describe("Deposits", () => {
    it("Sends money to contract", async () => {
      let transaction = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) });
      await transaction.wait();

      let result = await escrow.getBalance();
      expect(result).to.equal(tokens(5));
    });
  });

  describe("Inspection", () => {
    it("Updates inspection status", async () => {
      let transaction = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, true);
      await transaction.wait();

      let result = await escrow.inspectionPassed(1);
      expect(result).to.be.true;
    });

    it("Inspector allowence", async () => {
      await expect(
        escrow.connect(buyer).updateInspectionStatus(1, true)
      ).to.be.rejectedWith("You are not an Inspector");
    });
  });

  describe("Approval", () => {
    it("Updates approval status", async () => {
      let transaction = await escrow.connect(buyer).approve(1);
      await transaction.wait();

      transaction = await escrow.connect(seller).approve(1);
      await transaction.wait();

      transaction = await escrow.connect(lender).approve(1);
      await transaction.wait();

      let result = await escrow.approval(1, buyer.address);
      expect(result).to.be.true;

      result = await escrow.approval(1, seller.address);
      expect(result).to.be.true;

      result = await escrow.approval(1, lender.address);
      expect(result).to.be.true;
    });
  });

  describe("Sale", () => {
    let sellerBalanceBefore;

    beforeEach(async () => {
      let transaction = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) });
      await transaction.wait();

      transaction = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, true);
      await transaction.wait();

      transaction = await escrow.connect(buyer).approve(1);
      await transaction.wait();

      transaction = await escrow.connect(seller).approve(1);
      await transaction.wait();

      transaction = await escrow.connect(lender).approve(1);
      await transaction.wait();

      await lender.sendTransaction({ to: escrow.address, value: tokens(5) });

      sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

      transaction = await escrow.finalizeSale(1);
      await transaction.wait();
    });

    it("Updates the ownership", async () => {
      expect(await realEstate.ownerOf(1)).to.equal(buyer.address);
    });

    it("Updates the balance", async () => {
      expect(await escrow.getBalance()).to.equal(0);
    });

    it("sends money to seller address", async () => {
      let selleBalanceAfter = await ethers.provider.getBalance(seller.address);
      expect(selleBalanceAfter).to.be.greaterThan(sellerBalanceBefore);
    });
  });

  describe("Cancelation", () => {
    beforeEach(async () => {
      let transaction = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) });
      await transaction.wait();
    });
    it("Returns deposit to seller", async () => {
      let balanceBefore = await ethers.provider.getBalance(seller.address);
      let transaction = await escrow.connect(buyer).cancelSale(1);
      await transaction.wait();
      let balanceAfter = await ethers.provider.getBalance(seller.address);
      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });

    it("returns deposit to buyer", async () => {
      let balanceBefore = await ethers.provider.getBalance(buyer.address);
      let transaction = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, false);
      await transaction.wait();
      transaction = await escrow.connect(buyer).cancelSale(1);
      await transaction.wait();
      let balanceAfter = await ethers.provider.getBalance(buyer.address);
      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });
  });
});
