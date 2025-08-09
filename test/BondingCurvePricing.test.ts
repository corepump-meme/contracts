import { expect } from "chai";
import { ethers } from "hardhat";
// @ts-ignore
import { upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Bonding Curve Pricing Issues", function () {
  let coinFactory: any;
  let platformTreasury: any;
  let bondingCurveImpl: any;
  let priceOracle: any;
  let eventHub: any;
  let coin: any;
  let bondingCurve: any;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let buyer1: SignerWithAddress;
  let buyer2: SignerWithAddress;
  let seller: SignerWithAddress;

  const CREATION_FEE = ethers.parseEther("1");
  const BASE_PRICE = ethers.parseEther("0.0001"); // 0.0001 CORE per token
  const INITIAL_CORE_PRICE = 100000000; // $1.00 (8 decimals)

  beforeEach(async function () {
    [owner, creator, buyer1, buyer2, seller] = await ethers.getSigners();

    // Deploy SimpleTestPriceOracle
    const SimpleTestPriceOracle = await ethers.getContractFactory("SimpleTestPriceOracle");
    priceOracle = await SimpleTestPriceOracle.deploy(INITIAL_CORE_PRICE);
    await priceOracle.waitForDeployment();

    // Deploy PlatformTreasury
    const PlatformTreasury = await ethers.getContractFactory("PlatformTreasury");
    platformTreasury = await upgrades.deployProxy(PlatformTreasury, [], {
      initializer: "initialize",
      kind: "uups",
    });
    await platformTreasury.waitForDeployment();

    // Deploy EventHub
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

    // Deploy CoinFactory
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

    // Authorize contracts
    await platformTreasury.authorizeContract(await coinFactory.getAddress(), true);
    await eventHub.authorizeContract(await coinFactory.getAddress(), true);

    // Create a token for testing
    await coinFactory.connect(creator).createCoin(
      "Test Token",
      "TEST",
      "A test token for pricing tests",
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
    
    // Authorize bonding curve in event hub
    await eventHub.authorizeContract(bondingCurveAddress, true);
  });

  describe("Price Growth Issues", function () {
    it("Should demonstrate price increases with consecutive purchases", async function () {
      const buyAmount = ethers.parseEther("1"); // 1 CORE each buy
      
      // Record initial price
      const price1 = await bondingCurve.getCurrentPrice();
      console.log("Initial price:", ethers.formatEther(price1), "CORE per token");
      
      // First purchase
      await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      const price2 = await bondingCurve.getCurrentPrice();
      console.log("Price after 1st buy:", ethers.formatEther(price2), "CORE per token");
      
      // Second purchase 
      await bondingCurve.connect(buyer2).buyTokens({ value: buyAmount });
      const price3 = await bondingCurve.getCurrentPrice();
      console.log("Price after 2nd buy:", ethers.formatEther(price3), "CORE per token");
      
      // Third purchase
      await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      const price4 = await bondingCurve.getCurrentPrice();
      console.log("Price after 3rd buy:", ethers.formatEther(price4), "CORE per token");

      // Verify prices are increasing
      expect(price2, "Price should increase after first buy").to.be.greaterThan(price1);
      expect(price3, "Price should increase after second buy").to.be.greaterThan(price2);
      expect(price4, "Price should increase after third buy").to.be.greaterThan(price3);
      
      // Log state for debugging
      const state = await bondingCurve.getState();
      console.log("Final state - tokens sold:", ethers.formatEther(state.tokensSoldAmount));
      console.log("Final state - total raised:", ethers.formatEther(state.totalRaised));
    });

    it("Should demonstrate significant price increases with larger purchases", async function () {
      const smallBuy = ethers.parseEther("1");
      const largeBuy = ethers.parseEther("10");
      
      const initialPrice = await bondingCurve.getCurrentPrice();
      console.log("Initial price:", ethers.formatEther(initialPrice));
      
      // Small buy
      await bondingCurve.connect(buyer1).buyTokens({ value: smallBuy });
      const priceAfterSmall = await bondingCurve.getCurrentPrice();
      console.log("Price after small buy (1 CORE):", ethers.formatEther(priceAfterSmall));
      
      // Large buy
      await bondingCurve.connect(buyer2).buyTokens({ value: largeBuy });
      const priceAfterLarge = await bondingCurve.getCurrentPrice();
      console.log("Price after large buy (10 CORE):", ethers.formatEther(priceAfterLarge));
      
      // Log price differences
      console.log("Small buy price difference:", ethers.formatEther(priceAfterSmall - initialPrice), "CORE");
      console.log("Large buy price difference:", ethers.formatEther(priceAfterLarge - initialPrice), "CORE");
      
      expect(priceAfterSmall).to.be.greaterThan(initialPrice);
      expect(priceAfterLarge).to.be.greaterThan(priceAfterSmall);
    });
  });

  describe("Price Decrease Issues with Sells", function () {
    beforeEach(async function () {
      // Setup initial state with some purchases
      await bondingCurve.connect(buyer1).buyTokens({ value: ethers.parseEther("5") });
      await bondingCurve.connect(buyer2).buyTokens({ value: ethers.parseEther("5") });
    });

    it("Should demonstrate price behavior after sells", async function () {
      const initialPrice = await bondingCurve.getCurrentPrice();
      const initialState = await bondingCurve.getState();
      console.log("Before sell - Price:", ethers.formatEther(initialPrice));
      console.log("Before sell - Tokens sold:", ethers.formatEther(initialState.tokensSoldAmount));
      console.log("Before sell - Total raised:", ethers.formatEther(initialState.totalRaised));
      
      // Get buyer1's token balance and approve for selling
      const tokenBalance = await coin.balanceOf(buyer1.address);
      const sellAmount = tokenBalance / 2n; // Sell half
      await coin.connect(buyer1).approve(await bondingCurve.getAddress(), sellAmount);
      
      console.log("Selling tokens:", ethers.formatEther(sellAmount));
      
      // Perform sell
      await bondingCurve.connect(buyer1).sellTokens(sellAmount);
      
      const priceAfterSell = await bondingCurve.getCurrentPrice();
      const stateAfterSell = await bondingCurve.getState();
      console.log("After sell - Price:", ethers.formatEther(priceAfterSell));
      console.log("After sell - Tokens sold:", ethers.formatEther(stateAfterSell.tokensSoldAmount));
      console.log("After sell - Total raised:", ethers.formatEther(stateAfterSell.totalRaised));
      
      // This should show the issue: price might not behave as expected
      expect(priceAfterSell, "Price should decrease after sell").to.be.lessThan(initialPrice);
      
      // This will likely fail due to incorrect state management
      expect(stateAfterSell.totalRaised, "Total raised should not decrease on sells").to.be.greaterThanOrEqual(initialState.totalRaised);
    });

    it("Should demonstrate state corruption during sells", async function () {
      // Track initial state
      const initialTotalRaised = await bondingCurve.totalCoreRaised();
      const initialTokensSold = await bondingCurve.tokensSold();
      const initialContractBalance = await ethers.provider.getBalance(await bondingCurve.getAddress());
      
      console.log("BEFORE SELL:");
      console.log("Total CORE raised:", ethers.formatEther(initialTotalRaised));
      console.log("Tokens sold:", ethers.formatEther(initialTokensSold));
      console.log("Contract CORE balance:", ethers.formatEther(initialContractBalance));
      
      // Perform a sell
      const tokenBalance = await coin.balanceOf(buyer1.address);
      const sellAmount = tokenBalance / 3n; // Sell 1/3
      await coin.connect(buyer1).approve(await bondingCurve.getAddress(), sellAmount);
      await bondingCurve.connect(buyer1).sellTokens(sellAmount);
      
      // Track state after sell
      const finalTotalRaised = await bondingCurve.totalCoreRaised();
      const finalTokensSold = await bondingCurve.tokensSold();
      const finalContractBalance = await ethers.provider.getBalance(await bondingCurve.getAddress());
      
      console.log("AFTER SELL:");
      console.log("Total CORE raised:", ethers.formatEther(finalTotalRaised));
      console.log("Tokens sold:", ethers.formatEther(finalTokensSold));
      console.log("Contract CORE balance:", ethers.formatEther(finalContractBalance));
      
      // These assertions will likely fail, demonstrating the state corruption issues
      expect(finalTotalRaised, "Total raised should never decrease").to.be.greaterThanOrEqual(initialTotalRaised);
      expect(finalTokensSold, "Tokens sold should decrease on sells").to.be.lessThan(initialTokensSold);
    });
  });

  describe("Bonding Curve Mathematical Issues", function () {
    it("Should demonstrate price calculation inconsistencies", async function () {
      const buyAmount = ethers.parseEther("2");
      
      // Calculate expected tokens and price before buy
      const [expectedTokens, fee] = await bondingCurve.calculateTokensForCore(buyAmount);
      const priceBefore = await bondingCurve.getCurrentPrice();
      
      console.log("Before buy:");
      console.log("Current price:", ethers.formatEther(priceBefore));
      console.log("Expected tokens for", ethers.formatEther(buyAmount), "CORE:", ethers.formatEther(expectedTokens));
      console.log("Expected fee:", ethers.formatEther(fee));
      
      // Perform the buy
      await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      
      // Check actual results
      const priceAfter = await bondingCurve.getCurrentPrice();
      const actualTokens = await coin.balanceOf(buyer1.address);
      
      console.log("After buy:");
      console.log("New price:", ethers.formatEther(priceAfter));
      console.log("Actual tokens received:", ethers.formatEther(actualTokens));
      
      // These might show inconsistencies in the calculation
      expect(actualTokens).to.be.closeTo(expectedTokens, ethers.parseEther("1000"));
      expect(priceAfter).to.be.greaterThan(priceBefore);
    });

    it("Should demonstrate buy-sell-buy price inconsistencies", async function () {
      const buyAmount = ethers.parseEther("3");
      
      // Initial buy
      const price1 = await bondingCurve.getCurrentPrice();
      await bondingCurve.connect(seller).buyTokens({ value: buyAmount });
      const price2 = await bondingCurve.getCurrentPrice();
      
      // Sell half the tokens
      const tokenBalance = await coin.balanceOf(seller.address);
      const sellAmount = tokenBalance / 2n;
      await coin.connect(seller).approve(await bondingCurve.getAddress(), sellAmount);
      await bondingCurve.connect(seller).sellTokens(sellAmount);
      const price3 = await bondingCurve.getCurrentPrice();
      
      // Buy again with same amount
      await bondingCurve.connect(seller).buyTokens({ value: buyAmount });
      const price4 = await bondingCurve.getCurrentPrice();
      
      console.log("Price progression:");
      console.log("1. Initial:", ethers.formatEther(price1));
      console.log("2. After first buy:", ethers.formatEther(price2));
      console.log("3. After sell:", ethers.formatEther(price3));
      console.log("4. After second buy:", ethers.formatEther(price4));
      
      // These relationships should hold for a proper bonding curve
      expect(price2, "Price should increase after buy").to.be.greaterThan(price1);
      expect(price3, "Price should decrease after sell").to.be.lessThan(price2);
      expect(price4, "Price should increase after second buy").to.be.greaterThan(price3);
    });

    it("Should demonstrate graduation threshold calculation issues", async function () {
      const initialThreshold = await bondingCurve.getGraduationThreshold();
      const initialRaised = await bondingCurve.totalCoreRaised();
      
      console.log("Initial graduation threshold:", ethers.formatEther(initialThreshold));
      console.log("Initial raised:", ethers.formatEther(initialRaised));
      
      // Make some purchases
      await bondingCurve.connect(buyer1).buyTokens({ value: ethers.parseEther("100") });
      
      const raisedAfterBuy = await bondingCurve.totalCoreRaised();
      const thresholdAfterBuy = await bondingCurve.getGraduationThreshold();
      
      console.log("After buy - raised:", ethers.formatEther(raisedAfterBuy));
      console.log("After buy - threshold:", ethers.formatEther(thresholdAfterBuy));
      
      // Now try a sell
      const tokenBalance = await coin.balanceOf(buyer1.address);
      const sellAmount = tokenBalance / 4n;
      await coin.connect(buyer1).approve(await bondingCurve.getAddress(), sellAmount);
      await bondingCurve.connect(buyer1).sellTokens(sellAmount);
      
      const raisedAfterSell = await bondingCurve.totalCoreRaised();
      console.log("After sell - raised:", ethers.formatEther(raisedAfterSell));
      
      // This might demonstrate the issue with totalCoreRaised decreasing
      expect(raisedAfterSell, "Total raised should not decrease").to.be.greaterThanOrEqual(raisedAfterBuy);
    });
  });

  describe("Edge Case Price Issues", function () {
    it("Should handle rapid consecutive transactions", async function () {
      const buyAmount = ethers.parseEther("1");
      const prices: bigint[] = [];
      
      // Record initial price
      prices.push(await bondingCurve.getCurrentPrice());
      
      // Rapid buys
      for (let i = 0; i < 5; i++) {
        await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
        prices.push(await bondingCurve.getCurrentPrice());
      }
      
      // Log all prices
      console.log("Price progression:");
      prices.forEach((price, index) => {
        console.log(`${index}: ${ethers.formatEther(price)} CORE per token`);
      });
      
      // Verify monotonic increase
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i], `Price should increase at step ${i}`).to.be.greaterThan(prices[i-1]);
      }
    });

    it("Should demonstrate price stagnation issues", async function () {
      // Make initial purchases to set up state
      await bondingCurve.connect(buyer1).buyTokens({ value: ethers.parseEther("5") });
      
      const price1 = await bondingCurve.getCurrentPrice();
      
      // Make a very small purchase
      await bondingCurve.connect(buyer2).buyTokens({ value: ethers.parseEther("0.01") });
      
      const price2 = await bondingCurve.getCurrentPrice();
      
      console.log("Price before small buy:", ethers.formatEther(price1));
      console.log("Price after small buy:", ethers.formatEther(price2));
      
      // Even small buys should increase price in a proper bonding curve
      expect(price2, "Even small buys should increase price").to.be.greaterThan(price1);
    });
  });
});
