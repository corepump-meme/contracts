import { expect } from "chai";
import { ethers } from "hardhat";

describe("Bonding Curve Pricing Issues - Isolated Tests", function () {
  let bondingCurve: any;
  let owner: any;

  // Test constants - same as production
  const BASE_PRICE = ethers.parseEther("0.0001"); // 0.0001 CORE per token

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    
    // Deploy minimal BondingCurve for testing price calculations
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    bondingCurve = await BondingCurve.deploy();
    await bondingCurve.waitForDeployment();
  });

  describe("Price Calculation Issues", function () {
    it("Should demonstrate quadratic price calculation problems", async function () {
      // Test the getCurrentPrice function behavior 
      console.log("Testing getCurrentPrice() behavior...");
      
      // Since we can't initialize properly, let's test the mathematical issues
      // by examining what getCurrentPrice should return vs what it actually returns
      
      try {
        const price = await bondingCurve.getCurrentPrice();
        console.log("Current price (uninitialized):", ethers.formatEther(price));
        
        // This will likely return 0 or fail because basePrice isn't set
        // This demonstrates initialization dependency issues
        expect(price).to.equal(0); // Expecting 0 due to uninitialized state
        
      } catch (error: any) {
        console.log("Error calling getCurrentPrice():", error.message);
        // This demonstrates the initialization issues
        expect(error.message).to.include("revert");
      }
    });

    it("Should demonstrate mathematical precision issues in bonding curve", function () {
      // Test the mathematical issues directly with JavaScript calculations
      // to show what SHOULD happen vs what the contract likely does
      
      console.log("Demonstrating bonding curve math issues...");
      
      const totalSupply = 800_000_000n; // 800M tokens
      const basePrice = ethers.parseEther("0.0001"); // 0.0001 CORE
      
      // Simulate different amounts of tokens sold
      const testCases = [
        { tokensSold: 0n, label: "0 tokens sold" },
        { tokensSold: totalSupply / 100n, label: "1% of supply sold" },
        { tokensSold: totalSupply / 10n, label: "10% of supply sold" },
        { tokensSold: totalSupply / 2n, label: "50% of supply sold" }
      ];
      
      console.log("\nQuadratic bonding curve price progression:");
      console.log("Formula: price = basePrice * (1 + tokensSold/totalSupply)^2");
      
      testCases.forEach(({ tokensSold, label }) => {
        // This is the intended formula from the contract
        const progress = (tokensSold * 10n**18n) / totalSupply; // Scale by 10^18 for precision
        const progressPlusOne = 10n**18n + progress;
        const priceMultiplier = (progressPlusOne * progressPlusOne) / 10n**18n;
        const calculatedPrice = (basePrice * priceMultiplier) / 10n**18n;
        
        console.log(`${label}: ${ethers.formatEther(calculatedPrice)} CORE per token`);
        
        // The issue: precision loss and potential overflow in the contract
        // Also, this calculation doesn't account for the integral needed for proper bonding curves
      });
      
      console.log("\nISSUE: This approximation doesn't properly handle buy/sell calculations!");
      console.log("A proper bonding curve needs integral calculus for accurate pricing.");
    });

    it("Should demonstrate state management issues during sells", function () {
      // Demonstrate the logical error in sellTokens() function
      console.log("Demonstrating state management issues...");
      
      // Mock scenario: simulate what happens in sellTokens()
      let totalCoreRaised = 1000n; // 1000 CORE raised initially
      let tokensSold = 100000n; // 100k tokens sold
      
      console.log("BEFORE SELL:");
      console.log("Total CORE raised:", totalCoreRaised.toString());
      console.log("Tokens sold:", tokensSold.toString());
      
      // This is what the current sellTokens() does (WRONG):
      const coreToReceive = 100n; // Amount to give back to seller
      const fee = 1n; // 1% fee
      
      // INCORRECT state update from current contract:
      tokensSold -= 10000n; // Reduce tokens sold (correct)
      totalCoreRaised -= (coreToReceive + fee); // WRONG! This should never decrease
      
      console.log("AFTER SELL (current broken logic):");
      console.log("Total CORE raised:", totalCoreRaised.toString());
      console.log("Tokens sold:", tokensSold.toString());
      
      console.log("\nISSUE: totalCoreRaised should NEVER decrease!");
      console.log("This breaks graduation calculations and curve continuity.");
      
      // What it SHOULD be:
      console.log("\nCORRECT behavior:");
      console.log("Total CORE raised should remain:", (totalCoreRaised + coreToReceive + fee).toString());
      console.log("Only tokensSold should decrease, and a separate 'currentReserves' should track actual CORE balance");
    });

    it("Should demonstrate graduation threshold corruption", function () {
      console.log("Demonstrating graduation threshold issues...");
      
      // Mock CORE price oracle
      const corePrice = 100000000n; // $1.00 (8 decimals)
      const graduationUsdThreshold = 50000n; // $50,000
      
      // Calculate graduation threshold in CORE
      const graduationThreshold = (graduationUsdThreshold * 10n**26n) / corePrice;
      console.log("Graduation threshold:", ethers.formatEther(graduationThreshold), "CORE");
      
      // Simulate trading scenario
      let totalRaised = graduationThreshold / 2n; // Halfway to graduation
      console.log("Starting total raised:", ethers.formatEther(totalRaised), "CORE");
      
      // After some sells (with broken logic):
      const sellAmount = graduationThreshold / 10n; // 10% of threshold
      totalRaised -= sellAmount; // BROKEN: reduces totalRaised
      
      console.log("After sells (broken logic):", ethers.formatEther(totalRaised), "CORE");
      console.log("Graduation progress went BACKWARDS!");
      
      console.log("\nISSUE: Graduation can never be reached if sells reduce totalCoreRaised");
      console.log("This completely breaks the tokenomics model.");
    });
  });

  describe("Price Growth Demonstration", function () {
    it("Should show expected vs actual price behavior", function () {
      console.log("\n=== EXPECTED BONDING CURVE BEHAVIOR ===");
      
      // What SHOULD happen in a proper bonding curve:
      console.log("1. Prices should increase monotonically with buys");
      console.log("2. Prices should decrease with sells, but never break curve continuity");
      console.log("3. totalCoreRaised should never decrease");
      console.log("4. Price calculations should use integral calculus for accuracy");
      
      console.log("\n=== CURRENT IMPLEMENTATION PROBLEMS ===");
      console.log("1. getCurrentPrice() uses simplified approximation instead of proper curve math");
      console.log("2. sellTokens() incorrectly reduces totalCoreRaised");
      console.log("3. No separate tracking of actual CORE reserves vs total raised");
      console.log("4. Graduation threshold can be corrupted by sells");
      console.log("5. Price calculations don't account for integral-based bonding curve economics");
      
      console.log("\n=== REQUIRED FIXES ===");
      console.log("1. Implement proper bonding curve integration math");
      console.log("2. Add currentCoreReserves variable (can decrease)"); 
      console.log("3. Keep totalCoreRaised immutable (never decreases)");
      console.log("4. Fix graduation calculations to use correct state");
      console.log("5. Add invariant checks to prevent state corruption");
      
      // This test always passes - it's just demonstrating the issues
      expect(true).to.be.true;
    });

    it("Should demonstrate the impact on price discovery", function () {
      console.log("\n=== PRICE DISCOVERY ISSUES ===");
      
      // The current implementation breaks price discovery because:
      console.log("Current issues with price discovery:");
      console.log("1. Sells corrupt the curve state by reducing totalCoreRaised");
      console.log("2. Price calculations use current price instead of proper integral");
      console.log("3. State inconsistencies lead to unpredictable pricing");
      console.log("4. Users can't rely on consistent price increases");
      
      console.log("\nExample scenario:");
      console.log("- User buys tokens at 0.0001 CORE each");
      console.log("- Another user sells, corrupting totalCoreRaised");
      console.log("- Price calculation now based on corrupted state");
      console.log("- Next buyer gets inconsistent pricing");
      console.log("- Bonding curve economics completely broken");
      
      expect(true).to.be.true;
    });
  });
});
