import { expect } from "chai";
import { ethers } from "hardhat";
// @ts-ignore
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CorePump Platform", function () {
  let coinFactory: any;
  let platformTreasury: any;
  let bondingCurveImpl: any;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let buyer1: SignerWithAddress;
  let buyer2: SignerWithAddress;

  const CREATION_FEE = ethers.parseEther("1"); // 1 CORE
  const BASE_PRICE = ethers.parseEther("0.0001"); // 0.0001 CORE per token

  beforeEach(async function () {
    [owner, creator, buyer1, buyer2] = await ethers.getSigners();

    // Deploy PlatformTreasury
    const PlatformTreasury = await ethers.getContractFactory("PlatformTreasury");
    platformTreasury = await PlatformTreasury.deploy();
    await platformTreasury.initialize();

    // Deploy BondingCurve implementation
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    bondingCurveImpl = await BondingCurve.deploy();

    // Deploy Coin implementation
    const Coin = await ethers.getContractFactory("Coin");
    const coinImpl = await Coin.deploy(
      "Implementation",
      "IMPL",
      owner.address,
      owner.address,
      "Implementation contract",
      "",
      "",
      "",
      ""
    );

    // Deploy CoinFactory
    const CoinFactory = await ethers.getContractFactory("CoinFactory");
    coinFactory = await CoinFactory.deploy();
    await coinFactory.initialize(
      await platformTreasury.getAddress(),
      await coinImpl.getAddress(),
      await bondingCurveImpl.getAddress()
    );

    // Authorize CoinFactory in PlatformTreasury
    await platformTreasury.authorizeContract(await coinFactory.getAddress(), true);
  });

  describe("Platform Setup", function () {
    it("Should deploy all contracts correctly", async function () {
      expect(await coinFactory.platformTreasury()).to.equal(await platformTreasury.getAddress());
      expect(await coinFactory.getTotalCoins()).to.equal(0);
      
      const stats = await coinFactory.getPlatformStats();
      expect(stats[0]).to.equal(0); // totalCoins
      expect(stats[1]).to.equal(CREATION_FEE); // creationFee
      expect(stats[2]).to.equal(BASE_PRICE); // basePrice
    });

    it("Should have correct treasury authorization", async function () {
      expect(await platformTreasury.isAuthorizedContract(await coinFactory.getAddress())).to.be.true;
    });
  });

  describe("Token Creation", function () {
    it("Should create a new token successfully", async function () {
      const tx = await coinFactory.connect(creator).createCoin(
        "Test Token",
        "TEST",
        "A test token for the platform",
        "https://example.com/image.png",
        "https://example.com",
        "https://t.me/test",
        "https://twitter.com/test",
        { value: CREATION_FEE }
      );

      await expect(tx)
        .to.emit(coinFactory, "CoinCreated")
        .withArgs(
          (coinAddress: string) => coinAddress !== ethers.ZeroAddress,
          (bondingCurveAddress: string) => bondingCurveAddress !== ethers.ZeroAddress,
          creator.address,
          "Test Token",
          "TEST",
          CREATION_FEE
        );

      expect(await coinFactory.getTotalCoins()).to.equal(1);
    });

    it("Should fail with insufficient creation fee", async function () {
      await expect(
        coinFactory.connect(creator).createCoin(
          "Test Token",
          "TEST",
          "A test token",
          "",
          "",
          "",
          "",
          { value: ethers.parseEther("0.5") }
        )
      ).to.be.revertedWith("Insufficient creation fee");
    });

    it("Should fail with empty name", async function () {
      await expect(
        coinFactory.connect(creator).createCoin(
          "",
          "TEST",
          "A test token",
          "",
          "",
          "",
          "",
          { value: CREATION_FEE }
        )
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Should refund excess payment", async function () {
      const excessAmount = ethers.parseEther("2");
      const initialBalance = await ethers.provider.getBalance(creator.address);
      
      const tx = await coinFactory.connect(creator).createCoin(
        "Test Token",
        "TEST",
        "A test token",
        "",
        "",
        "",
        "",
        { value: excessAmount }
      );

      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const finalBalance = await ethers.provider.getBalance(creator.address);
      
      // Should only pay creation fee + gas, excess should be refunded
      expect(initialBalance - finalBalance).to.be.closeTo(CREATION_FEE + gasUsed, ethers.parseEther("0.01"));
    });
  });

  describe("Bonding Curve Trading", function () {
    let coin: any;
    let bondingCurve: any;

    beforeEach(async function () {
      // Create a token first
      await coinFactory.connect(creator).createCoin(
        "Test Token",
        "TEST",
        "A test token",
        "",
        "",
        "",
        "",
        { value: CREATION_FEE }
      );

      const coinAddress = (await coinFactory.getAllCoins())[0];
      coin = await ethers.getContractAt("Coin", coinAddress);
      
      const bondingCurveAddress = await coinFactory.coinToBondingCurve(coinAddress);
      bondingCurve = await ethers.getContractAt("BondingCurve", bondingCurveAddress);
    });

    it("Should allow buying tokens", async function () {
      const buyAmount = ethers.parseEther("1");
      const initialPrice = await bondingCurve.getCurrentPrice();
      
      const tx = await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      
      await expect(tx)
        .to.emit(bondingCurve, "TokenPurchased")
        .withArgs(
          buyer1.address,
          buyAmount,
          (tokenAmount: bigint) => tokenAmount > 0n,
          (newPrice: bigint) => newPrice >= initialPrice,
          (fee: bigint) => fee > 0n
        );

      expect(await coin.balanceOf(buyer1.address)).to.be.greaterThan(0);
    });

    it("Should enforce 4% purchase limit", async function () {
      const totalSupply = ethers.parseEther("1000000000"); // 1B tokens
      const maxPurchase = totalSupply * 4n / 100n; // 4% = 40M tokens
      
      // Calculate CORE needed to buy close to 4% (this is approximate)
      const largeBuyAmount = ethers.parseEther("100");
      
      // First purchase should succeed
      await bondingCurve.connect(buyer1).buyTokens({ value: largeBuyAmount });
      
      // Second large purchase should fail if it exceeds 4%
      await expect(
        bondingCurve.connect(buyer1).buyTokens({ value: largeBuyAmount })
      ).to.be.revertedWith("Purchase exceeds 4% limit");
    });

    it("Should allow selling tokens", async function () {
      // First buy some tokens
      const buyAmount = ethers.parseEther("1");
      await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      
      const tokenBalance = await coin.balanceOf(buyer1.address);
      const sellAmount = tokenBalance / 2n; // Sell half
      
      // Approve bonding curve to spend tokens
      await coin.connect(buyer1).approve(await bondingCurve.getAddress(), sellAmount);
      
      const tx = await bondingCurve.connect(buyer1).sellTokens(sellAmount);
      
      await expect(tx)
        .to.emit(bondingCurve, "TokenSold")
        .withArgs(
          buyer1.address,
          sellAmount,
          (coreAmount: bigint) => coreAmount > 0n,
          (newPrice: bigint) => newPrice > 0n,
          (fee: bigint) => fee > 0n
        );
    });

    it("Should increase price as tokens are sold", async function () {
      const initialPrice = await bondingCurve.getCurrentPrice();
      
      // Buy some tokens
      await bondingCurve.connect(buyer1).buyTokens({ value: ethers.parseEther("1") });
      
      const newPrice = await bondingCurve.getCurrentPrice();
      expect(newPrice).to.be.greaterThan(initialPrice);
    });

    it("Should collect platform fees", async function () {
      const initialTreasuryBalance = await ethers.provider.getBalance(await platformTreasury.getAddress());
      
      await bondingCurve.connect(buyer1).buyTokens({ value: ethers.parseEther("1") });
      
      const finalTreasuryBalance = await ethers.provider.getBalance(await platformTreasury.getAddress());
      expect(finalTreasuryBalance).to.be.greaterThan(initialTreasuryBalance);
    });
  });

  describe("Token Properties", function () {
    let coin: any;

    beforeEach(async function () {
      await coinFactory.connect(creator).createCoin(
        "Test Token",
        "TEST",
        "A test token for testing",
        "https://example.com/image.png",
        "https://example.com",
        "https://t.me/test",
        "https://twitter.com/test",
        { value: CREATION_FEE }
      );

      const coinAddress = (await coinFactory.getAllCoins())[0];
      coin = await ethers.getContractAt("Coin", coinAddress);
    });

    it("Should have correct token properties", async function () {
      expect(await coin.name()).to.equal("Test Token");
      expect(await coin.symbol()).to.equal("TEST");
      expect(await coin.totalSupply()).to.equal(ethers.parseEther("1000000000")); // 1B tokens
      expect(await coin.creator()).to.equal(creator.address);
    });

    it("Should have renounced ownership", async function () {
      expect(await coin.owner()).to.equal(ethers.ZeroAddress);
    });

    it("Should return correct metadata", async function () {
      const metadata = await coin.getTokenMetadata();
      expect(metadata[0]).to.equal("A test token for testing"); // description
      expect(metadata[1]).to.equal("https://example.com/image.png"); // image
      expect(metadata[2]).to.equal("https://example.com"); // website
      expect(metadata[3]).to.equal("https://t.me/test"); // telegram
      expect(metadata[4]).to.equal("https://twitter.com/test"); // twitter
    });
  });

  describe("Platform Treasury", function () {
    it("Should track fees correctly", async function () {
      // Create a token (generates creation fee)
      await coinFactory.connect(creator).createCoin(
        "Test Token",
        "TEST",
        "A test token",
        "",
        "",
        "",
        "",
        { value: CREATION_FEE }
      );

      const stats = await platformTreasury.getTreasuryStats();
      expect(stats[0]).to.be.greaterThan(0); // currentBalance
      expect(stats[5]).to.be.greaterThan(0); // totalReceived
    });

    it("Should allow owner to withdraw funds", async function () {
      // Create a token to generate fees
      await coinFactory.connect(creator).createCoin(
        "Test Token",
        "TEST",
        "A test token",
        "",
        "",
        "",
        "",
        { value: CREATION_FEE }
      );

      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      const treasuryBalance = await ethers.provider.getBalance(await platformTreasury.getAddress());
      
      const tx = await platformTreasury.connect(owner).withdrawAll();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      expect(finalOwnerBalance).to.be.closeTo(
        initialOwnerBalance + treasuryBalance - gasUsed,
        ethers.parseEther("0.01")
      );
    });
  });
});
