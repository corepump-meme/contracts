import { ethers } from "hardhat";
import { expect } from "chai";
import { BondingCurve } from "../typechain-types";

describe("Fixed Graduation Threshold", function () {
  let bondingCurve: BondingCurve;
  
  beforeEach(async function () {
    const [owner] = await ethers.getSigners();
    
    // Deploy a mock bonding curve for testing
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    bondingCurve = await BondingCurve.deploy();
    await bondingCurve.waitForDeployment();
  });

  describe("Graduation Threshold", function () {
    it("should return fixed graduation threshold of 116589 CORE", async function () {
      const threshold = await bondingCurve.getGraduationThreshold();
      const expectedThreshold = ethers.parseEther("116589");
      
      expect(threshold).to.equal(expectedThreshold);
    });

    it("should have correct GRADUATION_THRESHOLD constant", async function () {
      const threshold = await bondingCurve.GRADUATION_THRESHOLD();
      const expectedThreshold = ethers.parseEther("116589");
      
      expect(threshold).to.equal(expectedThreshold);
    });

    it("should return consistent threshold regardless of oracle price", async function () {
      // Call getGraduationThreshold multiple times - should always be the same
      const threshold1 = await bondingCurve.getGraduationThreshold();
      const threshold2 = await bondingCurve.getGraduationThreshold();
      
      expect(threshold1).to.equal(threshold2);
      expect(threshold1).to.equal(ethers.parseEther("116589"));
    });

    it("should have correct contract version", async function () {
      const version = await bondingCurve.version();
      expect(version).to.equal("2.1.0-fixed-graduation");
    });
  });

  describe("Graduation Progress Calculation", function () {
    it("should calculate graduation progress based on fixed threshold", async function () {
      // Test that getState uses the fixed threshold for progress calculation
      const state = await bondingCurve.getState();
      const [currentPrice, totalRaised, tokensSoldAmount, isGraduated, graduationProgress] = state;
      
      // With no tokens sold, should be 0% progress
      expect(graduationProgress).to.equal(0);
    });

    it("should calculate detailed state with fixed threshold", async function () {
      const detailedState = await bondingCurve.getDetailedState();
      const [
        currentPrice,
        totalRaised,
        currentReserves,
        tokensSoldAmount,
        isGraduated,
        graduationProgress,
        graduationThreshold
      ] = detailedState;
      
      expect(graduationThreshold).to.equal(ethers.parseEther("116589"));
      expect(graduationProgress).to.equal(0); // 0% with no purchases
    });
  });

  describe("Backward Compatibility", function () {
    it("should still have old USD threshold constant for compatibility", async function () {
      const oldThreshold = await bondingCurve.GRADUATION_USD_THRESHOLD();
      expect(oldThreshold).to.equal(50000); // $50,000 USD
    });

    it("should maintain contract interface compatibility", async function () {
      // Verify that all expected functions still exist with same signatures
      expect(typeof bondingCurve.getGraduationThreshold).to.equal("function");
      expect(typeof bondingCurve.getCurrentPrice).to.equal("function");
      expect(typeof bondingCurve.getState).to.equal("function");
      expect(typeof bondingCurve.getDetailedState).to.equal("function");
      expect(typeof bondingCurve.version).to.equal("function");
    });
  });
});
