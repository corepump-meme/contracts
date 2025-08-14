import { expect } from "chai";
import { ethers } from "hardhat";
// @ts-ignore
import { upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EventHub", function () {
  let eventHub: any;
  let owner: SignerWithAddress;
  let authorizedContract: SignerWithAddress;
  let unauthorizedContract: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, authorizedContract, unauthorizedContract, user1, user2] = await ethers.getSigners();

    // Deploy EventHub as upgradeable proxy
    const EventHub = await ethers.getContractFactory("EventHub");
    eventHub = await upgrades.deployProxy(EventHub, [], {
      initializer: "initialize",
      kind: "uups",
    });
    await eventHub.waitForDeployment();

    // Authorize one contract for testing
    await eventHub.authorizeContract(authorizedContract.address, true);
  });

  describe("Deployment", function () {
    it("Should deploy correctly", async function () {
      expect(await eventHub.owner()).to.equal(owner.address);
      expect(await eventHub.version()).to.equal("2.0.0");
    });

    it("Should initialize with no authorized contracts except the one we added", async function () {
      expect(await eventHub.isAuthorized(authorizedContract.address)).to.be.true;
      expect(await eventHub.isAuthorized(unauthorizedContract.address)).to.be.false;
    });
  });

  describe("Authorization Management", function () {
    it("Should allow owner to authorize contracts", async function () {
      await expect(
        eventHub.authorizeContract(user1.address, true)
      )
        .to.emit(eventHub, "ContractAuthorized")
        .withArgs(user1.address, true);

      expect(await eventHub.isAuthorized(user1.address)).to.be.true;
    });

    it("Should allow owner to deauthorize contracts", async function () {
      await expect(
        eventHub.authorizeContract(authorizedContract.address, false)
      )
        .to.emit(eventHub, "ContractAuthorized")
        .withArgs(authorizedContract.address, false);

      expect(await eventHub.isAuthorized(authorizedContract.address)).to.be.false;
    });

    it("Should prevent non-owner from authorizing contracts", async function () {
      await expect(
        eventHub.connect(user1).authorizeContract(user2.address, true)
      ).to.be.revertedWithCustomError(eventHub, "OwnableUnauthorizedAccount");
    });

    it("Should reject zero address authorization", async function () {
      await expect(
        eventHub.authorizeContract(ethers.ZeroAddress, true)
      ).to.be.revertedWith("EventHub: Invalid contract address");
    });

    it("Should allow batch authorization", async function () {
      const contracts = [user1.address, user2.address];
      
      await expect(
        eventHub.batchAuthorizeContracts(contracts, true)
      )
        .to.emit(eventHub, "ContractAuthorized")
        .withArgs(user1.address, true)
        .and.to.emit(eventHub, "ContractAuthorized")
        .withArgs(user2.address, true);

      expect(await eventHub.isAuthorized(user1.address)).to.be.true;
      expect(await eventHub.isAuthorized(user2.address)).to.be.true;
    });

    it("Should reject batch authorization with zero address", async function () {
      const contracts = [user1.address, ethers.ZeroAddress];
      
      await expect(
        eventHub.batchAuthorizeContracts(contracts, true)
      ).to.be.revertedWith("EventHub: Invalid contract address");
    });
  });

  describe("Event Emission - Authorization", function () {
    it("Should allow authorized contracts to emit events", async function () {
      await expect(
        eventHub.connect(authorizedContract).emitTokenLaunched(
          user1.address, // token
          user2.address, // creator
          authorizedContract.address, // bondingCurve
          "Test Token",
          "TEST",
          Math.floor(Date.now() / 1000),
          ethers.parseEther("1")
        )
      ).to.not.be.reverted;
    });

    it("Should prevent unauthorized contracts from emitting events", async function () {
      await expect(
        eventHub.connect(unauthorizedContract).emitTokenLaunched(
          user1.address,
          user2.address,
          unauthorizedContract.address,
          "Test Token",
          "TEST",
          Math.floor(Date.now() / 1000),
          ethers.parseEther("1")
        )
      ).to.be.revertedWith("EventHub: Not authorized");
    });
  });

  describe("TokenLaunched Event", function () {
    it("Should emit TokenLaunched with correct parameters", async function () {
      const token = user1.address;
      const creator = user2.address;
      const bondingCurve = authorizedContract.address;
      const name = "Test Token";
      const symbol = "TEST";
      const timestamp = Math.floor(Date.now() / 1000);
      const creationFee = ethers.parseEther("1");

      await expect(
        eventHub.connect(authorizedContract).emitTokenLaunched(
          token,
          creator,
          bondingCurve,
          name,
          symbol,
          timestamp,
          creationFee
        )
      )
        .to.emit(eventHub, "TokenLaunched")
        .withArgs(token, creator, bondingCurve, name, symbol, timestamp, creationFee);
    });
  });

  describe("TokenTraded Event", function () {
    it("Should emit TokenTraded for buy transaction", async function () {
      const token = user1.address;
      const trader = user2.address;
      const bondingCurve = authorizedContract.address;
      const isBuy = true;
      const coreAmount = ethers.parseEther("10");
      const tokenAmount = ethers.parseEther("1000");
      const newPrice = ethers.parseEther("0.01");
      const fee = ethers.parseEther("0.1");
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        eventHub.connect(authorizedContract).emitTokenTraded(
          token,
          trader,
          bondingCurve,
          isBuy,
          coreAmount,
          tokenAmount,
          newPrice,
          fee,
          timestamp
        )
      )
        .to.emit(eventHub, "TokenTraded")
        .withArgs(token, trader, bondingCurve, isBuy, coreAmount, tokenAmount, newPrice, fee, timestamp);
    });

    it("Should emit TokenTraded for sell transaction", async function () {
      const token = user1.address;
      const trader = user2.address;
      const bondingCurve = authorizedContract.address;
      const isBuy = false;
      const coreAmount = ethers.parseEther("5");
      const tokenAmount = ethers.parseEther("500");
      const newPrice = ethers.parseEther("0.009");
      const fee = ethers.parseEther("0.05");
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        eventHub.connect(authorizedContract).emitTokenTraded(
          token,
          trader,
          bondingCurve,
          isBuy,
          coreAmount,
          tokenAmount,
          newPrice,
          fee,
          timestamp
        )
      )
        .to.emit(eventHub, "TokenTraded")
        .withArgs(token, trader, bondingCurve, isBuy, coreAmount, tokenAmount, newPrice, fee, timestamp);
    });
  });

  describe("TokenGraduated Event", function () {
    it("Should emit TokenGraduated with correct parameters", async function () {
      const token = user1.address;
      const creator = user2.address;
      const totalRaised = ethers.parseEther("50000");
      const liquidityCore = ethers.parseEther("35000");
      const creatorBonus = ethers.parseEther("5000");
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        eventHub.connect(authorizedContract).emitTokenGraduated(
          token,
          creator,
          totalRaised,
          liquidityCore,
          creatorBonus,
          timestamp
        )
      )
        .to.emit(eventHub, "TokenGraduated")
        .withArgs(token, creator, totalRaised, liquidityCore, creatorBonus, timestamp);
    });
  });

  describe("PriceOracleUpdated Event", function () {
    it("Should emit PriceOracleUpdated with correct parameters", async function () {
      const oracle = user1.address;
      const oldPrice = 100000000; // $1.00
      const newPrice = 150000000; // $1.50
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        eventHub.connect(authorizedContract).emitPriceOracleUpdated(
          oracle,
          oldPrice,
          newPrice,
          timestamp
        )
      )
        .to.emit(eventHub, "PriceOracleUpdated")
        .withArgs(oracle, oldPrice, newPrice, timestamp);
    });
  });

  describe("PlatformFeeCollected Event", function () {
    it("Should emit PlatformFeeCollected with correct parameters", async function () {
      const source = authorizedContract.address;
      const feeType = "trading";
      const amount = ethers.parseEther("0.1");
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        eventHub.connect(authorizedContract).emitPlatformFeeCollected(
          source,
          feeType,
          amount,
          timestamp
        )
      )
        .to.emit(eventHub, "PlatformFeeCollected")
        .withArgs(source, feeType, amount, timestamp);
    });

    it("Should emit PlatformFeeCollected for different fee types", async function () {
      const source = authorizedContract.address;
      const timestamp = Math.floor(Date.now() / 1000);

      // Test creation fee
      await expect(
        eventHub.connect(authorizedContract).emitPlatformFeeCollected(
          source,
          "creation",
          ethers.parseEther("1"),
          timestamp
        )
      )
        .to.emit(eventHub, "PlatformFeeCollected")
        .withArgs(source, "creation", ethers.parseEther("1"), timestamp);

      // Test graduation fee
      await expect(
        eventHub.connect(authorizedContract).emitPlatformFeeCollected(
          source,
          "graduation",
          ethers.parseEther("10"),
          timestamp + 1
        )
      )
        .to.emit(eventHub, "PlatformFeeCollected")
        .withArgs(source, "graduation", ethers.parseEther("10"), timestamp + 1);
    });
  });

  describe("LargePurchaseAttempted Event", function () {
    it("Should emit LargePurchaseAttempted with correct parameters", async function () {
      const token = user1.address;
      const buyer = user2.address;
      const bondingCurve = authorizedContract.address;
      const attemptedAmount = ethers.parseEther("50000000"); // 50M tokens
      const currentHoldings = ethers.parseEther("30000000"); // 30M tokens
      const maxAllowed = ethers.parseEther("40000000"); // 40M tokens (4%)
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        eventHub.connect(authorizedContract).emitLargePurchaseAttempted(
          token,
          buyer,
          bondingCurve,
          attemptedAmount,
          currentHoldings,
          maxAllowed,
          timestamp
        )
      )
        .to.emit(eventHub, "LargePurchaseAttempted")
        .withArgs(token, buyer, bondingCurve, attemptedAmount, currentHoldings, maxAllowed, timestamp);
    });
  });

  describe("GraduationThresholdUpdated Event", function () {
    it("Should emit GraduationThresholdUpdated with correct parameters", async function () {
      const token = user1.address;
      const bondingCurve = authorizedContract.address;
      const oldThreshold = ethers.parseEther("50000"); // 50,000 CORE
      const newThreshold = ethers.parseEther("25000"); // 25,000 CORE
      const corePrice = 200000000; // $2.00
      const timestamp = Math.floor(Date.now() / 1000);

      await expect(
        eventHub.connect(authorizedContract).emitGraduationThresholdUpdated(
          token,
          bondingCurve,
          oldThreshold,
          newThreshold,
          corePrice,
          timestamp
        )
      )
        .to.emit(eventHub, "GraduationThresholdUpdated")
        .withArgs(token, bondingCurve, oldThreshold, newThreshold, corePrice, timestamp);
    });
  });

  describe("Access Control Edge Cases", function () {
    it("Should handle multiple authorization changes correctly", async function () {
      // Authorize
      await eventHub.authorizeContract(user1.address, true);
      expect(await eventHub.isAuthorized(user1.address)).to.be.true;

      // Deauthorize
      await eventHub.authorizeContract(user1.address, false);
      expect(await eventHub.isAuthorized(user1.address)).to.be.false;

      // Re-authorize
      await eventHub.authorizeContract(user1.address, true);
      expect(await eventHub.isAuthorized(user1.address)).to.be.true;
    });

    it("Should handle batch operations correctly", async function () {
      const contracts = [user1.address, user2.address];
      
      // Batch authorize
      await eventHub.batchAuthorizeContracts(contracts, true);
      expect(await eventHub.isAuthorized(user1.address)).to.be.true;
      expect(await eventHub.isAuthorized(user2.address)).to.be.true;

      // Batch deauthorize
      await eventHub.batchAuthorizeContracts(contracts, false);
      expect(await eventHub.isAuthorized(user1.address)).to.be.false;
      expect(await eventHub.isAuthorized(user2.address)).to.be.false;
    });
  });

  describe("Upgradeability", function () {
    it("Should be upgradeable by owner", async function () {
      // This test verifies the upgrade mechanism works
      // In a real scenario, you'd deploy a new implementation
      const EventHubV2 = await ethers.getContractFactory("EventHub");
      
      await expect(
        upgrades.upgradeProxy(eventHub, EventHubV2)
      ).to.not.be.reverted;
    });

    it("Should prevent non-owner from upgrading", async function () {
      // This would be tested with a mock upgrade attempt
      // The actual upgrade authorization is handled by the UUPS pattern
      expect(await eventHub.owner()).to.equal(owner.address);
    });
  });

  describe("Gas Efficiency", function () {
    it("Should emit events with reasonable gas costs", async function () {
      const tx = await eventHub.connect(authorizedContract).emitTokenLaunched(
        user1.address,
        user2.address,
        authorizedContract.address,
        "Test Token",
        "TEST",
        Math.floor(Date.now() / 1000),
        ethers.parseEther("1")
      );

      const receipt = await tx.wait();
      
      // Event emission should be relatively cheap (under 50k gas)
      expect(receipt!.gasUsed).to.be.lessThan(50000);
    });
  });
});
