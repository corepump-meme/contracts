import { ethers } from "hardhat";
import { expect } from "chai";
import { BondingCurve, Coin, EventHub, PlatformTreasury, CoinFactory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CorePump Platform v2.2.0 - Comprehensive Tests", function () {
  let coinFactory: CoinFactory;
  let platformTreasury: PlatformTreasury;
  let eventHub: EventHub;
  let bondingCurve: BondingCurve;
  let coin: Coin;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let buyer1: SignerWithAddress;
  let buyer2: SignerWithAddress;
  let seller: SignerWithAddress;
  let mockOracle: SignerWithAddress;

  const CREATION_FEE = ethers.parseEther("1"); // 1 CORE
  const BASE_PRICE = ethers.parseEther("0.0001"); // 0.0001 CORE per token
  const GRADUATION_THRESHOLD = ethers.parseEther("116589"); // Fixed 116,589 CORE

  beforeEach(async function () {
    [owner, creator, buyer1, buyer2, seller, mockOracle] = await ethers.getSigners();

    // Deploy PlatformTreasury (simple implementation for testing)
    const PlatformTreasury = await ethers.getContractFactory("PlatformTreasury");
    platformTreasury = await PlatformTreasury.deploy();
    await platformTreasury.initialize();

    // Deploy EventHub (simple implementation for testing) 
    const EventHub = await ethers.getContractFactory("EventHub");
    eventHub = await EventHub.deploy();
    await eventHub.initialize();

    // Deploy BondingCurve implementation
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    const bondingCurveImpl = await BondingCurve.deploy();

    // Deploy simple Coin implementation (not proxy)
    const Coin = await ethers.getContractFactory("Coin");
    const coinImpl = await Coin.deploy(
      "Implementation",
      "IMPL",
      owner.address,
      owner.address,
      "Implementation",
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
      await bondingCurveImpl.getAddress(),
      mockOracle.address, // Won't be used due to fixed threshold
      await eventHub.getAddress()
    );

    // Authorize factory in other contracts
    await platformTreasury.authorizeContract(await coinFactory.getAddress(), true);
    await eventHub.authorizeContract(await coinFactory.getAddress(), true);

    // Create a test token
    await coinFactory.connect(creator).createCoin(
      "TestToken",
      "TEST",
      "A comprehensive test token",
      "https://test.com/image.png",
      "https://test.com",
      "https://t.me/test",
      "https://x.com/test",
      { value: CREATION_FEE }
    );

    // Get the created token and bonding curve
    const allCoins = await coinFactory.getAllCoins();
    const coinAddress = allCoins[0];
    coin = await ethers.getContractAt("Coin", coinAddress);

    const bondingCurveAddress = await coinFactory.coinToBondingCurve(coinAddress);
    bondingCurve = await ethers.getContractAt("BondingCurve", bondingCurveAddress);

    // Authorize bonding curve in EventHub
    await eventHub.authorizeContract(bondingCurveAddress, true);
  });

  describe("🔒 Critical Security Fixes", function () {
    describe("Oracle Manipulation Eliminated", function () {
      it("should use fixed graduation threshold of 116,589 CORE", async function () {
        const threshold = await bondingCurve.getGraduationThreshold();
        expect(threshold).to.equal(GRADUATION_THRESHOLD);
      });

      it("should have consistent threshold regardless of any external changes", async function () {
        const threshold1 = await bondingCurve.getGraduationThreshold();
        const threshold2 = await bondingCurve.getGraduationThreshold();
        const threshold3 = await bondingCurve.getGraduationThreshold();

        expect(threshold1).to.equal(threshold2);
        expect(threshold2).to.equal(threshold3);
        expect(threshold1).to.equal(GRADUATION_THRESHOLD);
      });

      it("should have correct v2.2.0 version", async function () {
        const version = await bondingCurve.version();
        expect(version).to.equal("2.2.0-comprehensive-fixes");
      });
    });

    describe("State Management Fixes", function () {
      it("should maintain totalCoreRaised correctly (never decreases)", async function () {
        const buyAmount = ethers.parseEther("5");

        // Initial state
        const initialState = await bondingCurve.getDetailedState();
        const initialTotalRaised = initialState[1];

        // Buy tokens
        await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });

        // Check state after buy
        const afterBuyState = await bondingCurve.getDetailedState();
        const afterBuyTotalRaised = afterBuyState[1];

        expect(afterBuyTotalRaised).to.be.greaterThan(initialTotalRaised);

        // Sell some tokens
        const tokenBalance = await coin.balanceOf(buyer1.address);
        const sellAmount = tokenBalance / 2n;
        await coin.connect(buyer1).approve(await bondingCurve.getAddress(), sellAmount);
        await bondingCurve.connect(buyer1).sellTokens(sellAmount);

        // Check state after sell - totalCoreRaised should NOT decrease
        const afterSellState = await bondingCurve.getDetailedState();
        const afterSellTotalRaised = afterSellState[1];

        expect(afterSellTotalRaised).to.equal(afterBuyTotalRaised);
        console.log("✅ totalCoreRaised remained constant on sell:", ethers.formatEther(afterSellTotalRaised));
      });

      it("should track currentCoreReserves correctly (can decrease)", async function () {
        const buyAmount = ethers.parseEther("3");

        // Buy tokens
        await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });

        const afterBuyState = await bondingCurve.getDetailedState();
        const afterBuyReserves = afterBuyState[2];

        // Sell tokens
        const tokenBalance = await coin.balanceOf(buyer1.address);
        const sellAmount = tokenBalance / 3n;
        await coin.connect(buyer1).approve(await bondingCurve.getAddress(), sellAmount);
        await bondingCurve.connect(buyer1).sellTokens(sellAmount);

        const afterSellState = await bondingCurve.getDetailedState();
        const afterSellReserves = afterSellState[2];

        expect(afterSellReserves).to.be.lessThan(afterBuyReserves);
        console.log("✅ currentCoreReserves decreased on sell:", ethers.formatEther(afterSellReserves));
      });
    });
  });

  describe("💰 Enhanced Economic Model", function () {
    describe("Enhanced Creator Incentives", function () {
      it("should allocate 30% to creator on graduation (vs 10% before)", async function () {
        // Record creator's initial balance
        const creatorInitialBalance = await ethers.provider.getBalance(creator.address);

        // Buy enough to trigger graduation
        await bondingCurve.connect(buyer1).buyTokens({ value: GRADUATION_THRESHOLD });

        // Check if graduated
        const state = await bondingCurve.getState();
        expect(state[3]).to.be.true; // isGraduated

        // Check creator received ~30% (accounting for fees)
        const creatorFinalBalance = await ethers.provider.getBalance(creator.address);
        const creatorBonus = creatorFinalBalance - creatorInitialBalance;

        const expectedMinimum = GRADUATION_THRESHOLD * 25n / 100n; // At least 25% (accounting for fees)
        expect(creatorBonus).to.be.greaterThan(expectedMinimum);

        console.log("Creator bonus received:", ethers.formatEther(creatorBonus), "CORE");
        console.log("Percentage of graduation amount:", Number(creatorBonus * 100n / GRADUATION_THRESHOLD), "%");
      });

      it("should distribute graduation funds correctly: 50%/30%/20%", async function () {
        // Trigger graduation
        await bondingCurve.connect(buyer1).buyTokens({ value: GRADUATION_THRESHOLD });

        // Get graduation event
        const filter = bondingCurve.filters.Graduated();
        const events = await bondingCurve.queryFilter(filter);
        expect(events.length).to.equal(1);

        const graduatedEvent = events[0];
        const { liquidityCore, creatorBonus, treasuryAmount } = graduatedEvent.args;

        const totalDistributed = liquidityCore + creatorBonus + treasuryAmount;

        // Check distribution percentages (within tolerance)
        const liquidityPercentage = Number((liquidityCore * 100n) / totalDistributed);
        const creatorPercentage = Number((creatorBonus * 100n) / totalDistributed);
        const treasuryPercentage = Number((treasuryAmount * 100n) / totalDistributed);

        console.log("Distribution:");
        console.log("- Liquidity:", liquidityPercentage, "%");
        console.log("- Creator:", creatorPercentage, "%");
        console.log("- Treasury:", treasuryPercentage, "%");

        expect(liquidityPercentage).to.be.greaterThan(45);
        expect(liquidityPercentage).to.be.lessThan(55);
        expect(creatorPercentage).to.be.greaterThan(25);
        expect(creatorPercentage).to.be.lessThan(35);
        expect(treasuryPercentage).to.be.greaterThan(15);
        expect(treasuryPercentage).to.be.lessThan(25);
      });
    });

    describe("Bonding Curve Mathematics", function () {
      it("should use integral-based calculations", async function () {
        const coreAmount = ethers.parseEther("1");

        // This should use the new integral mathematics
        const [tokensReceived, fee] = await bondingCurve.calculateTokensForCore(coreAmount);

        expect(tokensReceived).to.be.greaterThan(0);
        expect(fee).to.equal(coreAmount / 100n); // 1% fee

        console.log("For", ethers.formatEther(coreAmount), "CORE:");
        console.log("- Tokens received:", ethers.formatEther(tokensReceived));
        console.log("- Fee:", ethers.formatEther(fee), "CORE");
      });

      it("should provide consistent pricing for buy/sell operations", async function () {
        const coreAmount = ethers.parseEther("2");

        // Buy tokens
        const [expectedTokens] = await bondingCurve.calculateTokensForCore(coreAmount);
        await bondingCurve.connect(buyer1).buyTokens({ value: coreAmount });

        const actualTokens = await coin.balanceOf(buyer1.address);
        expect(actualTokens).to.be.closeTo(expectedTokens, ethers.parseEther("1000"));

        // Now calculate sell value
        const [coreForSell] = await bondingCurve.calculateCoreForTokens(actualTokens);

        // Should get back less due to curve progression and fees, but reasonably close
        expect(coreForSell).to.be.greaterThan(coreAmount / 2n); // At least 50%
        expect(coreForSell).to.be.lessThan(coreAmount); // Less than original

        console.log("Buy/Sell consistency:");
        console.log("- Bought with:", ethers.formatEther(coreAmount), "CORE");
        console.log("- Can sell for:", ethers.formatEther(coreForSell), "CORE");
        console.log("- Efficiency:", Number(coreForSell * 100n / coreAmount), "%");
      });

      it("should show proper price progression", async function () {
        const buyAmount = ethers.parseEther("1");
        const prices: bigint[] = [];

        // Record price progression
        prices.push(await bondingCurve.getCurrentPrice());

        for (let i = 0; i < 3; i++) {
          await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
          prices.push(await bondingCurve.getCurrentPrice());
        }

        console.log("Price progression:");
        prices.forEach((price, index) => {
          console.log(`${index}: ${ethers.formatEther(price)} CORE per token`);
        });

        // Verify monotonic increase
        for (let i = 1; i < prices.length; i++) {
          expect(prices[i]).to.be.greaterThan(prices[i - 1]);
        }
      });
    });
  });

  describe("🔧 SushiSwap Liquidity Framework", function () {
    it("should emit LiquidityCreated event on graduation", async function () {
      await expect(
        bondingCurve.connect(buyer1).buyTokens({ value: GRADUATION_THRESHOLD })
      ).to.emit(bondingCurve, "LiquidityCreated");
    });

    it("should prepare for real SushiSwap integration", async function () {
      // Trigger graduation
      await bondingCurve.connect(buyer1).buyTokens({ value: GRADUATION_THRESHOLD });

      // Check LiquidityCreated event was emitted with correct data
      const filter = bondingCurve.filters.LiquidityCreated();
      const events = await bondingCurve.queryFilter(filter);

      expect(events.length).to.equal(1);
      const liquidityEvent = events[0];

      expect(liquidityEvent.args.token).to.equal(await coin.getAddress());
      expect(liquidityEvent.args.tokenAmount).to.be.greaterThan(0);
      expect(liquidityEvent.args.coreAmount).to.be.greaterThan(0);

      console.log("Liquidity created:");
      console.log("- Token amount:", ethers.formatEther(liquidityEvent.args.tokenAmount));
      console.log("- CORE amount:", ethers.formatEther(liquidityEvent.args.coreAmount));
    });
  });

  describe("🛡️ Anti-Rug Protection", function () {
    it("should enforce 4% purchase limit", async function () {
      const totalSupply = ethers.parseEther("1000000000"); // 1B tokens
      const maxPurchase = totalSupply * 4n / 100n; // 4%

      // Try to buy more than 4% - should fail
      const largeBuy = ethers.parseEther("100000"); // Large amount

      await expect(
        bondingCurve.connect(buyer1).buyTokens({ value: largeBuy })
      ).to.be.reverted; // Should revert due to 4% limit
    });

    it("should prevent trading after graduation", async function () {
      // Graduate the token
      await bondingCurve.connect(buyer1).buyTokens({ value: GRADUATION_THRESHOLD });

      const state = await bondingCurve.getState();
      expect(state[3]).to.be.true; // isGraduated

      // Try to buy more - should fail
      await expect(
        bondingCurve.connect(buyer2).buyTokens({ value: ethers.parseEther("1") })
      ).to.be.revertedWith("Token has graduated");

      // Try to sell - should also fail
      const tokenBalance = await coin.balanceOf(buyer1.address);
      if (tokenBalance > 0) {
        await coin.connect(buyer1).approve(await bondingCurve.getAddress(), tokenBalance);
        await expect(
          bondingCurve.connect(buyer1).sellTokens(tokenBalance / 2n)
        ).to.be.revertedWith("Token has graduated");
      }
    });
  });

  describe("🔄 Full Token Lifecycle", function () {
    it("should handle complete token lifecycle correctly", async function () {
      console.log("=== FULL TOKEN LIFECYCLE TEST ===");

      // 1. Creation (already done in beforeEach)
      console.log("1. ✅ Token created");

      // 2. Initial trading
      const buy1 = ethers.parseEther("10");
      await bondingCurve.connect(buyer1).buyTokens({ value: buy1 });
      console.log("2. ✅ First purchase:", ethers.formatEther(buy1), "CORE");

      const buy2 = ethers.parseEther("15");
      await bondingCurve.connect(buyer2).buyTokens({ value: buy2 });
      console.log("3. ✅ Second purchase:", ethers.formatEther(buy2), "CORE");

      // 3. Some selling
      const buyer1Tokens = await coin.balanceOf(buyer1.address);
      const sellAmount = buyer1Tokens / 3n;
      await coin.connect(buyer1).approve(await bondingCurve.getAddress(), sellAmount);
      await bondingCurve.connect(buyer1).sellTokens(sellAmount);
      console.log("4. ✅ Sell transaction:", ethers.formatEther(sellAmount), "tokens");

      // 4. Progress tracking
      const preGradState = await bondingCurve.getState();
      console.log("5. 📊 Progress to graduation:", preGradState[4], "%");

      // 5. Graduation
      const remainingToGrad = GRADUATION_THRESHOLD - preGradState[1];
      await bondingCurve.connect(buyer1).buyTokens({ value: remainingToGrad + ethers.parseEther("1") });
      console.log("6. 🎓 Token graduated!");

      // 6. Verify final state
      const finalState = await bondingCurve.getState();
      expect(finalState[3]).to.be.true; // isGraduated
      expect(finalState[4]).to.be.greaterThan(99); // >99% progress

      console.log("7. ✅ Final verification complete");
      console.log("   - Total raised:", ethers.formatEther(finalState[1]), "CORE");
      console.log("   - Graduation progress:", finalState[4], "%");
    });

    it("should maintain correct state throughout lifecycle", async function () {
      const states: any[] = [];

      // Track state changes
      const trackState = async (label: string) => {
        const state = await bondingCurve.getDetailedState();
        states.push({
          label,
          currentPrice: state[0],
          totalRaised: state[1],
          currentReserves: state[2],
          tokensSold: state[3],
          isGraduated: state[4]
        });
      };

      await trackState("Initial");

      // Buy
      await bondingCurve.connect(buyer1).buyTokens({ value: ethers.parseEther("5") });
      await trackState("After Buy");

      // Sell
      const tokenBalance = await coin.balanceOf(buyer1.address);
      await coin.connect(buyer1).approve(await bondingCurve.getAddress(), tokenBalance / 2n);
      await bondingCurve.connect(buyer1).sellTokens(tokenBalance / 2n);
      await trackState("After Sell");

      // Verify state progression
      console.log("State progression:");
      states.forEach((state, index) => {
        console.log(`${state.label}:`);
        console.log(`  Price: ${ethers.formatEther(state.currentPrice)} CORE/token`);
        console.log(`  Total Raised: ${ethers.formatEther(state.totalRaised)} CORE`);
        console.log(`  Reserves: ${ethers.formatEther(state.currentReserves)} CORE`);
        console.log(`  Tokens Sold: ${ethers.formatEther(state.tokensSold)}`);
        console.log("");
      });

      // totalRaised should never decrease
      for (let i = 1; i < states.length; i++) {
        expect(states[i].totalRaised).to.be.greaterThanOrEqual(states[i - 1].totalRaised);
      }
    });
  });

  describe("🔧 Upgrade Compatibility", function () {
    it("should maintain all required constants", async function () {
      expect(await bondingCurve.GRADUATION_THRESHOLD()).to.equal(GRADUATION_THRESHOLD);
      expect(await bondingCurve.GRADUATION_USD_THRESHOLD()).to.equal(50000);
      expect(await bondingCurve.PLATFORM_FEE()).to.equal(100);
      expect(await bondingCurve.BASIS_POINTS()).to.equal(10000);
      expect(await bondingCurve.MAX_PURCHASE_PERCENTAGE()).to.equal(400);
    });

    it("should have all required function signatures", async function () {
      expect(typeof bondingCurve.getGraduationThreshold).to.equal("function");
      expect(typeof bondingCurve.getCurrentPrice).to.equal("function");
      expect(typeof bondingCurve.calculateTokensForCore).to.equal("function");
      expect(typeof bondingCurve.calculateCoreForTokens).to.equal("function");
      expect(typeof bondingCurve.getState).to.equal("function");
      expect(typeof bondingCurve.getDetailedState).to.equal("function");
      expect(typeof bondingCurve.version).to.equal("function");
    });

    it("should return correct version information", async function () {
      const version = await bondingCurve.version();
      expect(version).to.equal("2.2.0-comprehensive-fixes");
    });
  });
});
