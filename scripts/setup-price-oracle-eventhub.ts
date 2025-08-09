import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Setting up price oracle EventHub integration with account:", deployer.address);

    // Get contract addresses from environment or deployment
    const eventHubAddress = process.env.EVENT_HUB_ADDRESS;
    const testnetOracleAddress = process.env.TESTNET_ORACLE_ADDRESS;
    const api3OracleAddress = process.env.API3_ORACLE_ADDRESS;

    if (!eventHubAddress) {
        console.error("EVENT_HUB_ADDRESS not found in environment");
        return;
    }

    console.log("EventHub address:", eventHubAddress);

    // Get contracts
    const EventHub = await ethers.getContractFactory("EventHub");
    const eventHub = EventHub.attach(eventHubAddress) as any;

    // Setup TestnetPriceOracle if available
    if (testnetOracleAddress) {
        console.log("\n=== Setting up TestnetPriceOracle ===");
        console.log("TestnetPriceOracle address:", testnetOracleAddress);

        const TestnetPriceOracle = await ethers.getContractFactory("TestnetPriceOracle");
        const testnetOracle = TestnetPriceOracle.attach(testnetOracleAddress) as any;

        try {
            // Authorize the oracle to emit events on EventHub
            console.log("Authorizing TestnetPriceOracle on EventHub...");
            const authTx = await eventHub.authorizeContract(testnetOracleAddress, true);
            await authTx.wait();
            console.log("✅ TestnetPriceOracle authorized on EventHub");

            // Set EventHub on the oracle
            console.log("Setting EventHub on TestnetPriceOracle...");
            const setEventHubTx = await testnetOracle.setEventHub(eventHubAddress);
            await setEventHubTx.wait();
            console.log("✅ EventHub configured on TestnetPriceOracle");

            // Test price update
            console.log("Testing price update...");
            const currentPrice = await testnetOracle.getPrice();
            console.log("Current price:", ethers.formatUnits(currentPrice, 8), "USD");

            const newPrice = currentPrice + ethers.parseUnits("0.10", 8); // Add $0.10
            console.log("Setting new price:", ethers.formatUnits(newPrice, 8), "USD");

            const setPriceTx = await testnetOracle.setPrice(newPrice);
            const receipt = await setPriceTx.wait();
            console.log("✅ Price updated successfully");

            // Check for events
            const priceUpdatedEvents = receipt?.logs?.filter((log: any) => {
                try {
                    const parsed = testnetOracle.interface.parseLog(log);
                    return parsed?.name === 'PriceUpdated';
                } catch {
                    return false;
                }
            });

            const eventHubEvents = receipt?.logs?.filter((log: any) => {
                try {
                    const parsed = eventHub.interface.parseLog(log);
                    return parsed?.name === 'PriceOracleUpdated';
                } catch {
                    return false;
                }
            });

            console.log(`Found ${priceUpdatedEvents?.length || 0} PriceUpdated events`);
            console.log(`Found ${eventHubEvents?.length || 0} PriceOracleUpdated events`);

        } catch (error) {
            console.error("Error setting up TestnetPriceOracle:", error);
        }
    }

    // Setup API3PriceOracle if available
    if (api3OracleAddress) {
        console.log("\n=== Setting up API3PriceOracle ===");
        console.log("API3PriceOracle address:", api3OracleAddress);

        const API3PriceOracle = await ethers.getContractFactory("API3PriceOracle");
        const api3Oracle = API3PriceOracle.attach(api3OracleAddress) as any;

        try {
            // Authorize the oracle to emit events on EventHub
            console.log("Authorizing API3PriceOracle on EventHub...");
            const authTx = await eventHub.authorizeContract(api3OracleAddress, true);
            await authTx.wait();
            console.log("✅ API3PriceOracle authorized on EventHub");

            // Set EventHub on the oracle
            console.log("Setting EventHub on API3PriceOracle...");
            const setEventHubTx = await api3Oracle.setEventHub(eventHubAddress);
            await setEventHubTx.wait();
            console.log("✅ EventHub configured on API3PriceOracle");

            // Test price check (this would normally be called periodically by external systems)
            console.log("Testing price check...");
            const checkTx = await api3Oracle.checkAndNotifyPriceUpdate();
            const receipt = await checkTx.wait();
            console.log("✅ Price check completed");

            // Check for events
            const priceChangeEvents = receipt?.logs?.filter((log: any) => {
                try {
                    const parsed = api3Oracle.interface.parseLog(log);
                    return parsed?.name === 'PriceChangeDetected';
                } catch {
                    return false;
                }
            });

            const eventHubEvents = receipt?.logs?.filter((log: any) => {
                try {
                    const parsed = eventHub.interface.parseLog(log);
                    return parsed?.name === 'PriceOracleUpdated';
                } catch {
                    return false;
                }
            });

            console.log(`Found ${priceChangeEvents?.length || 0} PriceChangeDetected events`);
            console.log(`Found ${eventHubEvents?.length || 0} PriceOracleUpdated events`);

            const [lastPrice, lastTimestamp] = await api3Oracle.getLastNotifiedPriceInfo();
            console.log("Last notified price:", ethers.formatUnits(lastPrice, 8), "USD");
            console.log("Last notified timestamp:", new Date(Number(lastTimestamp) * 1000).toISOString());

        } catch (error) {
            console.error("Error setting up API3PriceOracle:", error);
        }
    }

    console.log("\n=== Setup Complete ===");
    console.log("Price oracles are now configured to notify EventHub of price changes");
    console.log("For API3PriceOracle, call checkAndNotifyPriceUpdate() periodically to detect price changes");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
