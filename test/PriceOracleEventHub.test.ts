import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { EventHub } from "../typechain-types";

describe("Price Oracle EventHub Integration", function () {
    let eventHub: any;
    let testnetOracle: any;
    let api3Oracle: any;
    let owner: SignerWithAddress;
    let user: SignerWithAddress;
    let mockApi3Proxy: SignerWithAddress;

    const INITIAL_PRICE = ethers.parseUnits("1.50", 8); // $1.50

    beforeEach(async function () {
        [owner, user, mockApi3Proxy] = await ethers.getSigners();

        // Deploy EventHub
        const EventHub = await ethers.getContractFactory("EventHub");
        eventHub = (await EventHub.deploy()) as EventHub;
        await eventHub.waitForDeployment();
        await eventHub.initialize();

        // Deploy TestnetPriceOracle
        const TestnetPriceOracle = await ethers.getContractFactory("TestnetPriceOracle");
        testnetOracle = (await TestnetPriceOracle.deploy()) as any;
        await testnetOracle.waitForDeployment();
        await testnetOracle.initialize(INITIAL_PRICE);

        // Deploy MockApi3Proxy
        const MockApi3Proxy = await ethers.getContractFactory("MockApi3Proxy");
        const mockProxy = await MockApi3Proxy.deploy();
        await mockProxy.waitForDeployment();
        
        // Initialize with current price and timestamp
        await (mockProxy as any).updatePrice(INITIAL_PRICE, Math.floor(Date.now() / 1000));

        // Deploy API3PriceOracle
        const API3PriceOracle = await ethers.getContractFactory("API3PriceOracle");
        api3Oracle = (await API3PriceOracle.deploy(await mockProxy.getAddress())) as any;
        await api3Oracle.waitForDeployment();
        await api3Oracle.initialize();
    });

    describe("TestnetPriceOracle Integration", function () {
        it("Should setup EventHub integration correctly", async function () {
            // Authorize oracle on EventHub
            await eventHub.authorizeContract(await testnetOracle.getAddress(), true);
            
            // Set EventHub on oracle
            await testnetOracle.setEventHub(await eventHub.getAddress());

            // Verify authorization
            expect(await eventHub.isAuthorized(await testnetOracle.getAddress())).to.be.true;
        });

        it("Should emit PriceOracleUpdated event on price change", async function () {
            // Setup integration
            await eventHub.authorizeContract(await testnetOracle.getAddress(), true);
            await testnetOracle.setEventHub(await eventHub.getAddress());

            const newPrice = ethers.parseUnits("2.00", 8); // $2.00

            // Expect EventHub event
            await expect(testnetOracle.setPrice(newPrice))
                .to.emit(eventHub, "PriceOracleUpdated")
                .withArgs(
                    await testnetOracle.getAddress(),
                    INITIAL_PRICE,
                    newPrice,
                    await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1)
                );
        });

        it("Should not emit EventHub event if price doesn't change", async function () {
            // Setup integration
            await eventHub.authorizeContract(await testnetOracle.getAddress(), true);
            await testnetOracle.setEventHub(await eventHub.getAddress());

            // Set same price
            await expect(testnetOracle.setPrice(INITIAL_PRICE))
                .to.not.emit(eventHub, "PriceOracleUpdated");
        });

        it("Should handle batch price updates correctly", async function () {
            // Setup integration
            await eventHub.authorizeContract(await testnetOracle.getAddress(), true);
            await testnetOracle.setEventHub(await eventHub.getAddress());

            const prices = [
                ethers.parseUnits("1.60", 8),
                ethers.parseUnits("1.70", 8),
                ethers.parseUnits("1.80", 8)
            ];
            const intervals = [0, 0, 0]; // Same timestamp

            // Should emit multiple events
            const tx = await testnetOracle.simulatePriceUpdates(prices, intervals);
            const receipt = await tx.wait();

            // Count PriceOracleUpdated events
            const eventHubEvents = receipt?.logs?.filter((log: any) => {
                try {
                    const parsed = eventHub.interface.parseLog(log);
                    return parsed?.name === 'PriceOracleUpdated';
                } catch {
                    return false;
                }
            });

            expect(eventHubEvents?.length).to.equal(3);
        });

        it("Should fail if oracle is not authorized", async function () {
            // Don't authorize oracle
            await testnetOracle.setEventHub(await eventHub.getAddress());

            const newPrice = ethers.parseUnits("2.00", 8);

            // Should revert when trying to emit event
            await expect(testnetOracle.setPrice(newPrice))
                .to.be.revertedWith("EventHub: Not authorized");
        });
    });

    describe("API3PriceOracle Integration", function () {
        it("Should setup EventHub integration correctly", async function () {
            // Authorize oracle on EventHub
            await eventHub.authorizeContract(await api3Oracle.getAddress(), true);
            
            // Set EventHub on oracle
            await api3Oracle.setEventHub(await eventHub.getAddress());

            // Verify authorization
            expect(await eventHub.isAuthorized(await api3Oracle.getAddress())).to.be.true;
        });

        it("Should detect and notify price changes", async function () {
            // Setup integration
            await eventHub.authorizeContract(await api3Oracle.getAddress(), true);
            await api3Oracle.setEventHub(await eventHub.getAddress());

            // First check - should initialize tracking
            await api3Oracle.checkAndNotifyPriceUpdate();

            // Update mock proxy price
            const MockApi3Proxy = await ethers.getContractFactory("MockApi3Proxy");
            const mockProxy = MockApi3Proxy.attach(await api3Oracle.getProxyAddress());
            
            const newPrice = ethers.parseUnits("2.50", 8);
            const newTimestamp = Math.floor(Date.now() / 1000) + 100;
            await (mockProxy as any).updatePrice(newPrice, newTimestamp);

            // Check for price change - should emit events
            await expect(api3Oracle.checkAndNotifyPriceUpdate())
                .to.emit(eventHub, "PriceOracleUpdated")
                .withArgs(
                    await api3Oracle.getAddress(),
                    INITIAL_PRICE,
                    newPrice,
                    newTimestamp
                );
        });

        it("Should not notify if price hasn't changed", async function () {
            // Setup integration
            await eventHub.authorizeContract(await api3Oracle.getAddress(), true);
            await api3Oracle.setEventHub(await eventHub.getAddress());

            // First check
            await api3Oracle.checkAndNotifyPriceUpdate();

            // Second check with same price - should not emit
            await expect(api3Oracle.checkAndNotifyPriceUpdate())
                .to.not.emit(eventHub, "PriceOracleUpdated");
        });

        it("Should handle stale price data gracefully", async function () {
            // Setup integration
            await eventHub.authorizeContract(await api3Oracle.getAddress(), true);
            await api3Oracle.setEventHub(await eventHub.getAddress());

            // Update with very old timestamp (more than 1 hour ago)
            const MockApi3Proxy = await ethers.getContractFactory("MockApi3Proxy");
            const mockProxy = MockApi3Proxy.attach(await api3Oracle.getProxyAddress());
            
            const oldTimestamp = Math.floor(Date.now() / 1000) - 3700; // 1 hour + 100 seconds ago
            await (mockProxy as any).updatePrice(ethers.parseUnits("3.00", 8), oldTimestamp);

            // Should not emit event due to stale data
            await expect(api3Oracle.checkAndNotifyPriceUpdate())
                .to.not.emit(eventHub, "PriceOracleUpdated");
        });

        it("Should track last notified price info", async function () {
            // Setup integration
            await eventHub.authorizeContract(await api3Oracle.getAddress(), true);
            await api3Oracle.setEventHub(await eventHub.getAddress());

            // Initial state
            const [initialPrice, initialTimestamp] = await api3Oracle.getLastNotifiedPriceInfo();
            expect(initialPrice).to.equal(0);
            expect(initialTimestamp).to.equal(0);

            // First check
            await api3Oracle.checkAndNotifyPriceUpdate();

            // Check updated state
            const [updatedPrice, updatedTimestamp] = await api3Oracle.getLastNotifiedPriceInfo();
            expect(updatedPrice).to.equal(INITIAL_PRICE);
            expect(updatedTimestamp).to.be.gt(0);
        });
    });

    describe("EventHub Authorization", function () {
        it("Should allow owner to authorize contracts", async function () {
            await eventHub.authorizeContract(await testnetOracle.getAddress(), true);
            expect(await eventHub.isAuthorized(await testnetOracle.getAddress())).to.be.true;
        });

        it("Should allow owner to deauthorize contracts", async function () {
            await eventHub.authorizeContract(await testnetOracle.getAddress(), true);
            await eventHub.authorizeContract(await testnetOracle.getAddress(), false);
            expect(await eventHub.isAuthorized(await testnetOracle.getAddress())).to.be.false;
        });

        it("Should not allow non-owner to authorize contracts", async function () {
            await expect(
                eventHub.connect(user).authorizeContract(await testnetOracle.getAddress(), true)
            ).to.be.reverted;
        });

        it("Should batch authorize contracts", async function () {
            const addresses = [
                await testnetOracle.getAddress(),
                await api3Oracle.getAddress()
            ];

            await eventHub.batchAuthorizeContracts(addresses, true);

            expect(await eventHub.isAuthorized(addresses[0])).to.be.true;
            expect(await eventHub.isAuthorized(addresses[1])).to.be.true;
        });
    });
});
