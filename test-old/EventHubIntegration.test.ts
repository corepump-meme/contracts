import { expect } from "chai";
import { ethers } from "hardhat";
// @ts-ignore
import { upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EventHub Integration", function () {
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

  describe("Token Launch Events", function () {
    it("Should emit TokenLaunched event when creating a token", async function () {
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

      // Check that EventHub emitted TokenLaunched event
      await expect(tx)
        .to.emit(eventHub, "TokenLaunched")
        .withArgs(
          (tokenAddress: string) => tokenAddress !== ethers.ZeroAddress,
          creator.address,
          (bondingCurveAddress: string) => bondingCurveAddress !== ethers.ZeroAddress,
          "Test Token",
          "TEST",
          (timestamp: bigint) => timestamp > 0n,
          CREATION_FEE
        );
    });
  });

  describe("Trading Events", function () {
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

    it("Should emit TokenTraded event when buying tokens", async function () {
      const buyAmount = ethers.parseEther("1");
      
      const tx = await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      
      // Check that EventHub emitted TokenTraded event
      await expect(tx)
        .to.emit(eventHub, "TokenTraded")
        .withArgs(
          await coin.getAddress(),
          buyer1.address,
          await bondingCurve.getAddress(),
          true, // isBuy
          buyAmount,
          (tokenAmount: bigint) => tokenAmount > 0n,
          (newPrice: bigint) => newPrice > 0n,
          (fee: bigint) => fee > 0n,
          (timestamp: bigint) => timestamp > 0n
        );
    });

    it("Should emit TokenTraded event when selling tokens", async function () {
      // First buy some tokens
      const buyAmount = ethers.parseEther("1");
      await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      
      const tokenBalance = await coin.balanceOf(buyer1.address);
      const sellAmount = tokenBalance / 2n; // Sell half
      
      // Approve bonding curve to spend tokens
      await coin.connect(buyer1).approve(await bondingCurve.getAddress(), sellAmount);
      
      const tx = await bondingCurve.connect(buyer1).sellTokens(sellAmount);
      
      // Check that EventHub emitted TokenTraded event
      await expect(tx)
        .to.emit(eventHub, "TokenTraded")
        .withArgs(
          await coin.getAddress(),
          buyer1.address,
          await bondingCurve.getAddress(),
          false, // isBuy
          (coreAmount: bigint) => coreAmount > 0n,
          sellAmount,
          (newPrice: bigint) => newPrice > 0n,
          (fee: bigint) => fee > 0n,
          (timestamp: bigint) => timestamp > 0n
        );
    });

    it("Should track purchase amounts correctly with EventHub integration", async function () {
      // Make multiple purchases to verify tracking works
      const buyAmount = ethers.parseEther("100"); // 100 CORE per purchase
      
      // Initial purchase
      await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      let currentHoldings = await bondingCurve.purchaseAmounts(buyer1.address);
      let firstPurchaseAmount = currentHoldings;
      expect(currentHoldings).to.be.greaterThan(0);
      
      // Second purchase
      await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      currentHoldings = await bondingCurve.purchaseAmounts(buyer1.address);
      expect(currentHoldings).to.be.greaterThan(firstPurchaseAmount);
      
      // Third purchase
      await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      currentHoldings = await bondingCurve.purchaseAmounts(buyer1.address);
      expect(currentHoldings).to.be.greaterThan(firstPurchaseAmount * 2n);
      
      // Verify EventHub received all trading events
      const filter = eventHub.filters.TokenTraded();
      const events = await eventHub.queryFilter(filter);
      expect(events.length).to.equal(3);
      
      // Verify all events are buy transactions with correct CORE amounts
      for (const event of events) {
        expect(event.args[3]).to.equal(true); // isBuy
        expect(event.args[4]).to.equal(buyAmount); // coreAmount
        expect(event.args[5]).to.be.greaterThan(0); // tokenAmount
      }
      
      // Verify the total token balance matches the purchase tracking
      const tokenBalance = await coin.balanceOf(buyer1.address);
      expect(tokenBalance).to.equal(currentHoldings);
    });
  });

  describe("Full Token Lifecycle Events", function () {
    it("Should emit all relevant events during complete token lifecycle", async function () {
      // 1. Token Launch - should emit TokenLaunched
      const launchTx = await coinFactory.connect(creator).createCoin(
        "Lifecycle Token",
        "LIFE",
        "A token to test full lifecycle",
        "https://example.com/lifecycle.png",
        "https://lifecycle.com",
        "https://t.me/lifecycle",
        "https://twitter.com/lifecycle",
        { value: CREATION_FEE }
      );

      await expect(launchTx)
        .to.emit(eventHub, "TokenLaunched")
        .withArgs(
          (tokenAddress: string) => tokenAddress !== ethers.ZeroAddress,
          creator.address,
          (bondingCurveAddress: string) => bondingCurveAddress !== ethers.ZeroAddress,
          "Lifecycle Token",
          "LIFE",
          (timestamp: bigint) => timestamp > 0n,
          CREATION_FEE
        );

      // Get token and bonding curve addresses
      const coinAddress = (await coinFactory.getAllCoins())[0];
      const coin = await ethers.getContractAt("Coin", coinAddress);
      const bondingCurveAddress = await coinFactory.coinToBondingCurve(coinAddress);
      const bondingCurve = await ethers.getContractAt("BondingCurve", bondingCurveAddress);
      
      // Authorize the bonding curve to emit events
      await eventHub.authorizeContract(bondingCurveAddress, true);

      // 2. Trading - should emit TokenTraded events
      const buyAmount = ethers.parseEther("10");
      const buyTx = await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });

      await expect(buyTx)
        .to.emit(eventHub, "TokenTraded")
        .withArgs(
          coinAddress,
          buyer1.address,
          bondingCurveAddress,
          true, // isBuy
          buyAmount,
          (tokenAmount: bigint) => tokenAmount > 0n,
          (newPrice: bigint) => newPrice > 0n,
          (fee: bigint) => fee > 0n,
          (timestamp: bigint) => timestamp > 0n
        );

      // 3. More trading from different users
      const buyTx2 = await bondingCurve.connect(buyer2).buyTokens({ value: buyAmount });

      await expect(buyTx2)
        .to.emit(eventHub, "TokenTraded")
        .withArgs(
          coinAddress,
          buyer2.address,
          bondingCurveAddress,
          true, // isBuy
          buyAmount,
          (tokenAmount: bigint) => tokenAmount > 0n,
          (newPrice: bigint) => newPrice > 0n,
          (fee: bigint) => fee > 0n,
          (timestamp: bigint) => timestamp > 0n
        );

      // Verify that multiple events were emitted to EventHub
      const filter = eventHub.filters.TokenTraded();
      const events = await eventHub.queryFilter(filter);
      expect(events.length).to.be.greaterThan(1);
    });
  });

  describe("Event Data Integrity", function () {
    let coin: any;
    let bondingCurve: any;

    beforeEach(async function () {
      // Create a token first
      await coinFactory.connect(creator).createCoin(
        "Data Test Token",
        "DATA",
        "A token to test event data integrity",
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

    it("Should emit events with accurate transaction data", async function () {
      const buyAmount = ethers.parseEther("5");
      const initialPrice = await bondingCurve.getCurrentPrice();
      
      const tx = await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      
      // Get the TokenTraded event from EventHub
      const filter = eventHub.filters.TokenTraded();
      const events = await eventHub.queryFilter(filter, receipt!.blockNumber, receipt!.blockNumber);
      
      expect(events.length).to.equal(1);
      const event = events[0];
      
      // Verify event data matches transaction data
      expect(event.args[0]).to.equal(await coin.getAddress()); // token
      expect(event.args[1]).to.equal(buyer1.address); // trader
      expect(event.args[2]).to.equal(await bondingCurve.getAddress()); // bondingCurve
      expect(event.args[3]).to.equal(true); // isBuy
      expect(event.args[4]).to.equal(buyAmount); // coreAmount
      expect(event.args[5]).to.be.greaterThan(0); // tokenAmount
      expect(event.args[6]).to.be.greaterThan(initialPrice); // newPrice
      expect(event.args[7]).to.be.greaterThan(0); // fee
      expect(event.args[8]).to.equal(block!.timestamp); // timestamp
    });

    it("Should maintain event ordering across multiple transactions", async function () {
      const buyAmount = ethers.parseEther("1");
      
      // Make multiple purchases
      await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      await bondingCurve.connect(buyer2).buyTokens({ value: buyAmount });
      await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      
      // Get all TokenTraded events
      const filter = eventHub.filters.TokenTraded();
      const events = await eventHub.queryFilter(filter);
      
      expect(events.length).to.equal(3);
      
      // Verify events are in chronological order
      for (let i = 1; i < events.length; i++) {
        expect(events[i].args[8]).to.be.greaterThanOrEqual(events[i-1].args[8]); // timestamp ordering
      }
      
      // Verify trader addresses match expected sequence
      expect(events[0].args[1]).to.equal(buyer1.address);
      expect(events[1].args[1]).to.equal(buyer2.address);
      expect(events[2].args[1]).to.equal(buyer1.address);
    });
  });

  describe("Gas Cost Analysis", function () {
    let coin: any;
    let bondingCurve: any;

    beforeEach(async function () {
      // Create a token first
      await coinFactory.connect(creator).createCoin(
        "Gas Test Token",
        "GAS",
        "A token to test gas costs",
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

    it("Should have reasonable gas overhead for EventHub integration", async function () {
      const buyAmount = ethers.parseEther("1");
      
      const tx = await bondingCurve.connect(buyer1).buyTokens({ value: buyAmount });
      const receipt = await tx.wait();
      
      // Gas usage should be reasonable (under 250k gas for a buy transaction with EventHub)
      expect(receipt!.gasUsed).to.be.lessThan(250000);
      
      // The EventHub integration should add minimal overhead
      // (approximately 30k-50k gas for event emission)
      console.log(`      Gas used for buy with EventHub: ${receipt!.gasUsed.toString()}`);
    });
  });
});
