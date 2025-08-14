import { ethers } from "hardhat";
import { expect } from "chai";
import { BondingCurve, Coin, EventHub, PlatformTreasury } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Comprehensive Fixes v2.2.0", function () {
  let bondingCurve: BondingCurve;
  let coin: Coin;
  let eventHub: EventHub;
  let treasury: PlatformTreasury;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let buyer: SignerWithAddress;
  let mockOracle: SignerWithAddress;

  beforeEach(async function () {
    [owner, creator, buyer, mockOracle] = await ethers.getSigners();
    
    // Deploy EventHub
    const EventHub = await ethers.getContractFactory("EventHub");
    eventHub = await EventHub.deploy();
    await eventHub.initialize();
    
    // Deploy PlatformTreasury
    const PlatformTreasury = await ethers.getContractFactory("PlatformTreasury");
    treasury = await PlatformTreasury.deploy();
    await treasury.initialize();
    
    // Deploy BondingCurve
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    bondingCurve = await BondingCurve.deploy();
    
    // Deploy Coin (this creates the token)
    const Coin = await ethers.getContractFactory("Coin");
    coin = await Coin.deploy(
      "TestToken",
      "TEST",
      creator.address,
      await bondingCurve.getAddress(),
      "Test token description",
      "https://test.com/image.png",
      "https://test.com",
      "https://t.me/test",
      "https://x.com/test"
    );
    
    // Initialize bonding curve
    await bondingCurve.initialize(
      await coin.getAddress(),
      creator.address,
      await treasury.getAddress(),
      ethers.parseEther("0.0001"), // 0.0001 CORE base price
      mockOracle.address, // Mock oracle (won't be used due to fixed threshold)
      await eventHub.getAddress()
    );
  });

  describe("Critical Security Fix: Oracle Manipulation Eliminated", function () {
    it("should use fixed graduation threshold of 116,589 CORE", async function () {
      const threshold = await bondingCurve.getGraduationThreshold();
      expect(threshold).to.equal(ethers.parseEther("116589"));
    });

    it("should have consistent threshold regardless of oracle manipulation", async function () {
      // Call multiple times - should always be the same
      const threshold1 = await bondingCurve.getGraduationThreshold();
      const threshold2 = await bondingCurve.getGraduationThreshold();
      const threshold3 = await bondingCurve.getGraduationThreshold();
      
      expect(threshold1).to.equal(threshold2);
      expect(threshold2).to.equal(threshold3);
      expect(threshold1).to.equal(ethers.parseEther("116589"));
    });

    it("should have correct contract version", async function () {
      const version = await bondingCurve.version();
      expect(version).to.equal("2.2.0-comprehensive-fixes");
    });
  });

  describe("Enhanced Creator Incentives", function () {
    it("should allocate 30% to creator on graduation (vs 10% before)", async function () {
      // Buy tokens to reach graduation threshold
      const graduationThreshold = await bondingCurve.getGraduationThreshold();
      const creatorInitialBalance = await ethers.provider.getBalance(creator.address);
      
      // Buy tokens worth the graduation threshold
      await bondingCurve.connect(buyer).buyTokens({
        value: graduationThreshold
      });
      
      // Check if graduated
      const state = await bondingCurve.getState();
      expect(state[3]).to.be.true; // isGraduated should be true
      
      const creatorFinalBalance = await ethers.provider.getBalance(creator.address);
      const creatorBonus = creatorFinalBalance - creatorInitialBalance;
      
      // Creator should receive 30% of the graduation funds (minus fees)
      const expectedMinimum = graduationThreshold * 25n / 100n; // At least 25% (accounting for fees)
      expect(creatorBonus).to.be.greaterThan(expectedMinimum);
    });
  });

  describe("Integral-Based Bonding Curve Mathematics", function () {
    it("should use integral calculations for token purchases", async function () {
      const coreAmount = ethers.parseEther("1");
      const [tokensReceived, fee] = await bondingCurve.calculateTokensForCore(coreAmount);
      
      expect(tokensReceived).to.be.greaterThan(0);
      expect(fee).to.equal(coreAmount / 100n); // 1% fee
    });

    it("should use integral calculations for token sells", async function () {
      // First buy some tokens
      const purchaseAmount = ethers.parseEther("10");
      await bondingCurve.connect(buyer).buyTokens({ value: purchaseAmount });
      
      const buyerTokenBalance = await coin.balanceOf(buyer.address);
      expect(buyerTokenBalance).to.be.greaterThan(0);
      
      // Calculate sell value using integral math
      const sellAmount = buyerTokenBalance / 2n; // Sell half
      const [coreReceived, sellFee] = await bondingCurve.calculateCoreForTokens(sellAmount);
      
      expect(coreReceived).to.be.greaterThan(0);
      expect(sellFee).to.be.greaterThan(0);
    });

    it("should have consistent buy/sell pricing through integrals", async function () {
      const coreAmount = ethers.parseEther("5");
      
      // Calculate tokens for CORE purchase
      const [tokensForPurchase] = await bondingCurve.calculateTokensForCore(coreAmount);
      
      // Buy the tokens
      await bondingCurve.connect(buyer).buyTokens({ value: coreAmount });
      
      // Now calculate CORE for selling those exact tokens
      const [coreForSale] = await bondingCurve.calculateCoreForTokens(tokensForPurchase);
      
      // Due to integral calculations, sell should be slightly less than buy (due to curve progression)
      // But should be reasonably close (within 10% for small trades)
      const difference = coreAmount - coreForSale;
      expect(difference).to.be.lessThan(coreAmount / 10n); // Less than 10% difference
    });
  });

  describe("Enhanced Graduation Distribution", function () {
    it("should distribute graduation funds correctly: 50% liquidity, 30% creator, 20% treasury", async function () {
      const graduationThreshold = await bondingCurve.getGraduationThreshold();
      
      // Buy tokens to graduate
      await bondingCurve.connect(buyer).buyTokens({ value: graduationThreshold });
      
      // Check graduation event was emitted
      const filter = bondingCurve.filters.Graduated();
      const events = await bondingCurve.queryFilter(filter);
      expect(events.length).to.equal(1);
      
      const graduatedEvent = events[0];
      const { liquidityCore, creatorBonus, treasuryAmount } = graduatedEvent.args;
      
      // Verify distribution percentages (approximately, accounting for fees)
      const totalDistributed = liquidityCore + creatorBonus + treasuryAmount;
      
      // Liquidity should be ~50%
      const liquidityPercentage = Number((liquidityCore * 100n) / totalDistributed);
      expect(liquidityPercentage).to.be.greaterThan(45); // Within 5% due to integer math
      expect(liquidityPercentage).to.be.lessThan(55);
      
      // Creator should be ~30%
      const creatorPercentage = Number((creatorBonus * 100n) / totalDistributed);
      expect(creatorPercentage).to.be.greaterThan(25);
      expect(creatorPercentage).to.be.lessThan(35);
      
      // Treasury should be ~20%
      const treasuryPercentage = Number((treasuryAmount * 100n) / totalDistributed);
      expect(treasuryPercentage).to.be.greaterThan(15);
      expect(treasuryPercentage).to.be.lessThan(25);
    });

    it("should emit LiquidityCreated event on graduation", async function () {
      const graduationThreshold = await bondingCurve.getGraduationThreshold();
      
      // Expect LiquidityCreated event
      await expect(
        bondingCurve.connect(buyer).buyTokens({ value: graduationThreshold })
      ).to.emit(bondingCurve, "LiquidityCreated");
    });
  });

  describe("State Consistency and Security", function () {
    it("should maintain totalCoreRaised vs currentCoreReserves correctly", async function () {
      const purchaseAmount = ethers.parseEther("10");
      
      // Buy tokens
      await bondingCurve.connect(buyer).buyTokens({ value: purchaseAmount });
      
      const state = await bondingCurve.getDetailedState();
      const [, totalRaised, currentReserves] = state;
      
      // totalCoreRaised should be >= currentCoreReserves (due to fees)
      expect(totalRaised).to.be.greaterThanOrEqual(currentReserves);
      
      // Sell some tokens
      const tokenBalance = await coin.balanceOf(buyer.address);
      const sellAmount = tokenBalance / 4n; // Sell 25%
      
      await coin.connect(buyer).approve(await bondingCurve.getAddress(), sellAmount);
      await bondingCurve.connect(buyer).sellTokens(sellAmount);
      
      const stateAfterSell = await bondingCurve.getDetailedState();
      const [, totalRaisedAfter, currentReservesAfter] = stateAfterSell;
      
      // totalCoreRaised should remain the same (cumulative)
      expect(totalRaisedAfter).to.equal(totalRaised);
      
      // currentCoreReserves should decrease
      expect(currentReservesAfter).to.be.lessThan(currentReserves);
    });

    it("should prevent trading after graduation", async function () {
      const graduationThreshold = await bondingCurve.getGraduationThreshold();
      
      // Graduate the token
      await bondingCurve.connect(buyer).buyTokens({ value: graduationThreshold });
      
      // Verify graduation
      const state = await bondingCurve.getState();
      expect(state[3]).to.be.true; // isGraduated
      
      // Try to buy more tokens - should fail
      await expect(
        bondingCurve.connect(buyer).buyTokens({ value: ethers.parseEther("1") })
      ).to.be.revertedWith("Token has graduated");
      
      // Try to sell tokens - should fail
      const tokenBalance = await coin.balanceOf(buyer.address);
      if (tokenBalance > 0) {
        await coin.connect(buyer).approve(await bondingCurve.getAddress(), tokenBalance);
        await expect(
          bondingCurve.connect(buyer).sellTokens(tokenBalance / 2n)
        ).to.be.revertedWith("Token has graduated");
      }
    });
  });

  describe("Upgrade Compatibility", function () {
    it("should maintain all required storage variables for upgrades", async function () {
      // Verify all critical storage variables exist and are accessible
      expect(await bondingCurve.GRADUATION_THRESHOLD()).to.equal(ethers.parseEther("116589"));
      expect(await bondingCurve.GRADUATION_USD_THRESHOLD()).to.equal(50000); // Kept for compatibility
      expect(await bondingCurve.PLATFORM_FEE()).to.equal(100);
      expect(await bondingCurve.BASIS_POINTS()).to.equal(10000);
      expect(await bondingCurve.MAX_PURCHASE_PERCENTAGE()).to.equal(400);
    });

    it("should have working state getter functions", async function () {
      const state = await bondingCurve.getState();
      expect(state.length).to.equal(5);
      
      const detailedState = await bondingCurve.getDetailedState();
      expect(detailedState.length).to.equal(7);
      
      const version = await bondingCurve.version();
      expect(version).to.equal("2.2.0-comprehensive-fixes");
    });
  });
});
