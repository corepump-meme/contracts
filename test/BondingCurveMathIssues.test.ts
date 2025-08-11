import { expect } from "chai";
import { ethers } from "hardhat";

describe("Bonding Curve Mathematical Issues - Pure Math Tests", function () {

  describe("Critical Pricing Issues Demonstration", function () {
    
    it("Should demonstrate the core state management issue", function () {
      console.log("\n=== CRITICAL STATE MANAGEMENT BUG ===");
      console.log("Found in BondingCurve.sol line ~320 in sellTokens() function:");
      console.log("");
      console.log("BROKEN CODE:");
      console.log("  tokensSold -= tokenAmount;");
      console.log("  totalCoreRaised -= (coreToReceive + fee);  // ❌ THIS IS WRONG!");
      console.log("");
      
      // Simulate the broken behavior
      let totalCoreRaised = ethers.parseEther("1000"); // 1000 CORE raised
      let tokensSold = ethers.parseEther("1000000"); // 1M tokens sold
      let graduationThreshold = ethers.parseEther("50000"); // Need 50k CORE to graduate
      
      console.log("SCENARIO: Token halfway to graduation");
      console.log("Initial total CORE raised:", ethers.formatEther(totalCoreRaised), "CORE");
      console.log("Graduation threshold:", ethers.formatEther(graduationThreshold), "CORE");
      console.log("Progress to graduation:", (Number(totalCoreRaised) / Number(graduationThreshold) * 100).toFixed(2) + "%");
      
      // User sells tokens
      const coreToReceive = ethers.parseEther("100"); // Give back 100 CORE
      const fee = ethers.parseEther("1"); // 1% fee = 1 CORE
      
      console.log("\nUser sells tokens and receives:", ethers.formatEther(coreToReceive), "CORE");
      console.log("Fee paid:", ethers.formatEther(fee), "CORE");
      
      // Apply broken logic from current contract
      totalCoreRaised -= (coreToReceive + fee); // THIS IS THE BUG!
      
      console.log("\nAFTER SELL (with broken logic):");
      console.log("Total CORE raised:", ethers.formatEther(totalCoreRaised), "CORE");
      console.log("Progress to graduation:", (Number(totalCoreRaised) / Number(graduationThreshold) * 100).toFixed(2) + "%");
      console.log("");
      console.log("❌ GRADUATION PROGRESS WENT BACKWARDS!");
      console.log("❌ totalCoreRaised should NEVER decrease!");
      console.log("❌ This completely breaks tokenomics!");
      
      // Demonstrate the correct approach
      console.log("\n=== CORRECT APPROACH ===");
      const correctTotalRaised = ethers.parseEther("1000"); // Should never change
      console.log("Total CORE raised (correct):", ethers.formatEther(correctTotalRaised), "CORE");
      console.log("✅ Graduation progress stays consistent");
      console.log("✅ Use separate 'currentCoreReserves' that can decrease");
    });

    it("Should demonstrate bonding curve math issues", function () {
      console.log("\n=== BONDING CURVE MATHEMATICAL PROBLEMS ===");
      console.log("Current implementation in getCurrentPrice() has several issues:\n");
      
      const basePrice = ethers.parseEther("0.0001"); // 0.0001 CORE per token
      const totalSupply = 800_000_000n * 10n**18n; // 800M tokens
      
      console.log("Current formula: price = basePrice * (1 + progress)^2");
      console.log("Where progress = tokensSold / totalSupply\n");
      
      // Test different scenarios
      const scenarios = [
        { tokensSold: 0n, label: "Start (0% sold)" },
        { tokensSold: totalSupply / 100n, label: "Early (1% sold)" },
        { tokensSold: totalSupply / 10n, label: "Growing (10% sold)" },
        { tokensSold: totalSupply / 2n, label: "Mature (50% sold)" }
      ];
      
      console.log("CALCULATED PRICES:");
      scenarios.forEach(({ tokensSold, label }) => {
        // Current contract logic (with precision issues)
        const progress = (tokensSold * 10n**18n) / totalSupply;
        const progressPlusOne = 10n**18n + progress;
        const priceMultiplier = (progressPlusOne * progressPlusOne) / 10n**18n;
        const currentPrice = (basePrice * priceMultiplier) / 10n**18n;
        
        console.log(`${label}: ${ethers.formatEther(currentPrice)} CORE per token`);
      });
      
      console.log("\n❌ ISSUES WITH CURRENT APPROACH:");
      console.log("1. Uses point price instead of integral calculus");
      console.log("2. calculateTokensForCore() uses approximation, not exact math");
      console.log("3. Buy/sell calculations don't match curve integral");
      console.log("4. Precision loss in multiplication/division");
      console.log("5. No consideration for slippage in large trades");
      
      console.log("\n✅ PROPER BONDING CURVE NEEDS:");
      console.log("1. Integral calculus for exact token/CORE calculations");
      console.log("2. Separate formulas for buy and sell operations");
      console.log("3. Consistent state that doesn't corrupt the curve");
      console.log("4. Price should reflect actual supply/demand dynamics");
    });

    it("Should demonstrate graduation corruption scenario", function () {
      console.log("\n=== GRADUATION CORRUPTION SCENARIO ===");
      
      const graduationThreshold = ethers.parseEther("50000"); // 50k CORE needed
      console.log("Graduation requirement:", ethers.formatEther(graduationThreshold), "CORE\n");
      
      // Simulate a token approaching graduation
      let totalCoreRaised = ethers.parseEther("45000"); // 90% to graduation
      console.log("Token progress: 90% to graduation");
      console.log("Total CORE raised:", ethers.formatEther(totalCoreRaised), "CORE");
      console.log("Need", ethers.formatEther(graduationThreshold - totalCoreRaised), "more CORE to graduate\n");
      
      // Large buy pushes over graduation threshold
      const largeBuy = ethers.parseEther("10000"); // 10k CORE buy
      totalCoreRaised += largeBuy;
      console.log("🎉 Large buy of", ethers.formatEther(largeBuy), "CORE");
      console.log("Total raised:", ethers.formatEther(totalCoreRaised), "CORE");
      console.log("✅ TOKEN GRADUATED! Liquidity added to DEX");
      
      // But wait... someone sells (with broken logic)
      const sellCoreAmount = ethers.parseEther("6000"); // User gets 6k CORE back
      const sellFee = ethers.parseEther("60"); // 1% fee
      
      console.log("\n❌ User sells tokens, receives", ethers.formatEther(sellCoreAmount), "CORE");
      console.log("Current broken logic reduces totalCoreRaised:");
      totalCoreRaised -= (sellCoreAmount + sellFee); // BROKEN LOGIC
      
      console.log("Total raised after sell:", ethers.formatEther(totalCoreRaised), "CORE");
      console.log("❌ NOW BELOW GRADUATION THRESHOLD!");
      console.log("❌ But token already graduated and has DEX liquidity!");
      console.log("❌ State is completely corrupted!\n");
      
      console.log("This creates impossible situations:");
      console.log("- Token graduated but totalCoreRaised < threshold");
      console.log("- Graduation calculations become meaningless");
      console.log("- Future tokens can't rely on consistent graduation logic");
      console.log("- Platform economics are fundamentally broken");
    });

    it("Should show the mathematical fix needed", function () {
      console.log("\n=== THE MATHEMATICAL FIX NEEDED ===");
      
      console.log("CURRENT STATE VARIABLES (broken):");
      console.log("- totalCoreRaised: increases on buys, DECREASES on sells ❌");
      console.log("- tokensSold: increases on buys, decreases on sells ✅");
      console.log("- No separate reserve tracking ❌");
      
      console.log("\nCORRECTED STATE VARIABLES:");
      console.log("- totalCoreRaised: ONLY increases, never decreases ✅"); 
      console.log("- tokensSold: increases on buys, decreases on sells ✅");
      console.log("- currentCoreReserves: tracks actual CORE in contract ✅");
      
      console.log("\nCORRECT LOGIC FOR SELLS:");
      console.log("1. Calculate CORE to give back based on bonding curve");
      console.log("2. Reduce tokensSold (affects price calculation) ✅");
      console.log("3. Reduce currentCoreReserves (not totalCoreRaised!) ✅");
      console.log("4. Keep totalCoreRaised unchanged for graduation ✅");
      console.log("5. Transfer CORE from reserves to seller ✅");
      
      console.log("\nBONDING CURVE MATH FIXES:");
      console.log("1. Implement proper integral for calculateTokensForCore()");
      console.log("2. Implement proper integral for calculateCoreForTokens()");
      console.log("3. Ensure price calculations use consistent state");
      console.log("4. Add invariant checks to prevent corruption");
      
      console.log("\nGRADUATION FIXES:");
      console.log("1. Use totalCoreRaised for graduation (never decreases)");
      console.log("2. Use currentCoreReserves for liquidity calculations");
      console.log("3. Add checks to prevent double graduation");
      console.log("4. Ensure graduated tokens can't corrupt their state");
      
      expect(true).to.be.true; // Test passes - this is documentation
    });

    it("Should show specific code changes needed", function () {
      console.log("\n=== SPECIFIC CODE CHANGES REQUIRED ===");
      
      console.log("1. ADD NEW STATE VARIABLE:");
      console.log("   uint256 public currentCoreReserves; // Actual CORE balance");
      console.log("");
      
      console.log("2. FIX sellTokens() FUNCTION:");
      console.log("   ❌ REMOVE: totalCoreRaised -= (coreToReceive + fee);");
      console.log("   ✅ ADD:    currentCoreReserves -= (coreToReceive + fee);");
      console.log("");
      
      console.log("3. FIX buyTokens() FUNCTION:");
      console.log("   ✅ KEEP:   totalCoreRaised += msg.value;");
      console.log("   ✅ ADD:    currentCoreReserves += msg.value;");
      console.log("");
      
      console.log("4. FIX GRADUATION LOGIC:");
      console.log("   ✅ CHECK:  totalCoreRaised >= getGraduationThreshold()");
      console.log("   ✅ USE:    currentCoreReserves for liquidity distribution");
      console.log("");
      
      console.log("5. IMPROVE BONDING CURVE MATH:");
      console.log("   - Implement proper integral calculus");
      console.log("   - Fix precision issues in price calculations");
      console.log("   - Add slippage protection for large trades");
      console.log("");
      
      console.log("6. ADD INVARIANT CHECKS:");
      console.log("   - totalCoreRaised should never decrease");
      console.log("   - currentCoreReserves should match contract balance");
      console.log("   - Graduated tokens should not allow further graduation");
      
      expect(true).to.be.true; // Test passes - this is documentation
    });
  });
});
