import { expect } from "chai";
import { ethers } from "hardhat";
// @ts-ignore
import { upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CorePump Platform", function () {
  let coinFactory: any;
  let platformTreasury: any;
  let bondingCurveImpl: any;
  let priceOracle: any;
  let eventHub: any;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let buyer1: SignerWithAddress;
  let buyer2: SignerWithAddress;

  const CREATION_FEE = ethers.parseEther("1"); // 1 CORE
  const BASE_PRICE = ethers.parseEther("0.0001"); // 0.0001 CORE per token
  const INITIAL_CORE_PRICE = 100000000; // $1.00 (8 decimals)

  beforeEach(async function () {
    [owner, creator, buyer1, buyer2] = await ethers.getSigners();

    // Deploy SimpleTestPriceOracle (non-upgradeable for testing)
    const SimpleTestPriceOracle = await ethers.getContractFactory("SimpleTestPriceOracle");
    priceOracle = await SimpleTestPriceOracle.deploy(INITIAL_CORE_PRICE);
    await priceOracle.waitForDeployment();

    // Deploy PlatformTreasury (upgradeable)
    const PlatformTreasury = await ethers.getContractFactory("PlatformTreasury");
    platformTreasury = await upgrades.deployProxy(PlatformTreasury, [], {
      initializer: "initialize",
      kind: "uups",
    });
    await platformTreasury.waitForDeployment();

    // Deploy EventHub (upgradeable)
    const EventHub = await ethers.getContractFactory("EventHub");
    eventHub = await upgrades.deployProxy(EventHub, [], {
      initializer: "initialize",
      kind: "uups",
    });
    await eventHub.waitForDeployment();

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

    // Deploy CoinFactory (upgradeable)
    const CoinFactory = await ethers.getContractFactory("CoinFactory");
    coinFactory = await upgrades.deployProxy(
      CoinFactory,
      [
        await platformTreasury.getAddress(),
        await coinImpl.getAddress(),
        await bondingCurveImpl.getAddress(),
        await priceOracle.getAddress(),
        await eventHub.getAddress()
      ],
      {
        initializer: "initialize",
        kind: "uups",
      }
    );
    await coinFactory.waitForDeployment();

    // Authorize CoinFactory in PlatformTreasury
    await platformTreasury.authorizeContract(await coinFactory.getAddress(), true);
    
    // Authorize CoinFactory in EventHub
    await eventHub.authorizeContract(await coinFactory.getAddress(), true);
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
      const expectedCost = CREATION_FEE + gasUsed;
      const actualCost = initialBalance - finalBalance;
      expect(actualCost).to.be.closeTo(expectedCost, ethers.parseEther("0.01"));
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
      
      // Authorize the bonding curve to emit events
      await eventHub.authorizeContract(bondingCurveAddress, true);
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
      // Calculate 4% of total supply (1B tokens) = 40M tokens
      const totalSupply = ethers.parseEther("1000000000"); // 1B tokens
      const fourPercentLimit = totalSupply * 4n / 100n; // 40M tokens
      
      // Make multiple smaller purchases to approach the 4% limit
      const buyAmount = ethers.parseEther("1000"); // 1000 CORE per purchase
      let totalPurchased = 0n;
      
      // Buy tokens in chunks until we get close to the 4% limit
      for (let i = 0; i < 3; i++) {
        await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
        totalPurchased = await bondingCurve.purchaseAmounts(buyer1.address);
        
        // If we're getting close to the limit, break
        if (totalPurchased > fourPercentLimit * 8n / 10n) { // 80% of limit
          break;
        }
      }
      
      // Now make a large purchase that should exceed the 4% limit
      const largeBuyAmount = ethers.parseEther("5000"); // Large amount to trigger limit
      
      await expect(
        bondingCurve.connect(buyer1).buyTokens({ value: largeBuyAmount })
      ).to.be.revertedWith("Purchase exceeds 4% limit");
      
      // Verify we haven't exceeded the limit
      const finalPurchased = await bondingCurve.purchaseAmounts(buyer1.address);
      expect(finalPurchased).to.be.lessThan(fourPercentLimit);
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
      expect(await coin.totalSupply()).to.equal(ethers.parseEther("800000000")); // 800M tokens (80% of 1B)
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

  describe("Price Oracle Integration", function () {
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

    it("Should have correct initial price oracle setup", async function () {
      const currentPrice = await priceOracle.getPrice();
      expect(currentPrice).to.equal(INITIAL_CORE_PRICE); // $1.00
      
      const graduationThreshold = await bondingCurve.getGraduationThreshold();
      // At $1.00 CORE price, graduation should need 50,000 CORE
      expect(graduationThreshold).to.equal(ethers.parseEther("50000"));
    });

    it("Should update graduation threshold when CORE price changes", async function () {
      // Set CORE price to $2.00
      const newPrice = 200000000; // $2.00 (8 decimals)
      await priceOracle.setPrice(newPrice);
      
      const graduationThreshold = await bondingCurve.getGraduationThreshold();
      // At $2.00 CORE price, graduation should need 25,000 CORE
      expect(graduationThreshold).to.equal(ethers.parseEther("25000"));
    });

    it("Should handle low CORE prices correctly", async function () {
      // Set CORE price to $0.50
      const newPrice = 50000000; // $0.50 (8 decimals)
      await priceOracle.setPrice(newPrice);
      
      const graduationThreshold = await bondingCurve.getGraduationThreshold();
      // At $0.50 CORE price, graduation should need 100,000 CORE
      expect(graduationThreshold).to.equal(ethers.parseEther("100000"));
    });

    it("Should reflect price changes in bonding curve state", async function () {
      // Initial state at $1.00 CORE
      let state = await bondingCurve.getState();
      let initialThreshold = (50000n * 10n**26n) / BigInt(INITIAL_CORE_PRICE);
      
      // Change CORE price to $0.25 (makes graduation easier in CORE terms)
      const newPrice = 25000000; // $0.25 (8 decimals)
      await priceOracle.setPrice(newPrice);
      
      // Check new graduation threshold
      const newThreshold = await bondingCurve.getGraduationThreshold();
      expect(newThreshold).to.equal(ethers.parseEther("200000")); // 200,000 CORE needed
      
      // The graduation threshold should be higher (more CORE needed) when CORE price is lower
      expect(newThreshold).to.be.greaterThan(initialThreshold);
    });

    it("Should allow price oracle owner to update prices", async function () {
      const initialPrice = await priceOracle.getPrice();
      
      // Update price
      const newPrice = 150000000; // $1.50
      await priceOracle.connect(owner).setPrice(newPrice);
      
      const updatedPrice = await priceOracle.getPrice();
      expect(updatedPrice).to.equal(newPrice);
      expect(updatedPrice).to.not.equal(initialPrice);
    });

    it("Should prevent non-owner from updating price oracle", async function () {
      const newPrice = 150000000; // $1.50
      
      await expect(
        priceOracle.connect(creator).setPrice(newPrice)
      ).to.be.revertedWith("Not the owner");
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
      const expectedBalance = initialOwnerBalance + treasuryBalance - gasUsed;
      expect(finalOwnerBalance).to.be.closeTo(
        expectedBalance,
        ethers.parseEther("0.01")
      );
    });
  });
});
