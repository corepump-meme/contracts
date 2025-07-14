import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== CorePump Testnet Price Oracle Demo ===");
  console.log("Account:", deployer.address);

  // This assumes you have already deployed the contracts
  // Replace with your actual deployed addresses
  const TESTNET_PRICE_ORACLE_ADDRESS = "YOUR_DEPLOYED_ORACLE_ADDRESS";
  
  if (TESTNET_PRICE_ORACLE_ADDRESS === "YOUR_DEPLOYED_ORACLE_ADDRESS") {
    console.log("\n❌ Please update TESTNET_PRICE_ORACLE_ADDRESS with your deployed oracle address");
    console.log("Run 'npm run deploy:local' first to deploy contracts");
    return;
  }

  // Connect to the deployed TestnetPriceOracle
  const TestnetPriceOracle = await ethers.getContractFactory("TestnetPriceOracle");
  const priceOracle = TestnetPriceOracle.attach(TESTNET_PRICE_ORACLE_ADDRESS) as any;

  // Get current price
  console.log("\n1. Current CORE Price:");
  const currentPrice = await priceOracle.getPrice();
  const formatted = await priceOracle.getPriceFormatted();
  console.log(`   Raw: ${currentPrice} (8 decimals)`);
  console.log(`   Formatted: $${formatted[0]}.${formatted[1].toString().padStart(2, '0')}`);

  // Calculate graduation threshold
  const graduationThreshold = (50000n * 10n**26n) / currentPrice;
  console.log(`   Graduation Threshold: ${ethers.formatEther(graduationThreshold)} CORE`);

  // Demonstrate price updates
  console.log("\n2. Testing Price Updates:");
  
  const testPrices = [
    { price: 150000000, label: "$1.50" }, // Bull market
    { price: 50000000, label: "$0.50" },  // Bear market
    { price: 200000000, label: "$2.00" }, // Higher price
    { price: 100000000, label: "$1.00" }, // Back to $1
  ];

  for (const test of testPrices) {
    console.log(`\n   Setting price to ${test.label}...`);
    await priceOracle.setPrice(test.price);
    
    const newPrice = await priceOracle.getPrice();
    const newThreshold = (50000n * 10n**26n) / newPrice;
    
    console.log(`   ✅ Price updated: ${ethers.formatUnits(newPrice, 8)} USD`);
    console.log(`   📊 New graduation threshold: ${ethers.formatEther(newThreshold)} CORE`);
    
    // Small delay for demonstration
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Demonstrate batch price simulation
  console.log("\n3. Batch Price Simulation:");
  const batchPrices = [120000000, 140000000, 160000000]; // $1.20, $1.40, $1.60
  const intervals = [0, 3600, 7200]; // 0s, 1h, 2h intervals
  
  console.log("   Simulating gradual price increase...");
  await priceOracle.simulatePriceUpdates(batchPrices, intervals);
  console.log("   ✅ Batch simulation complete");

  // Final status
  console.log("\n4. Final Status:");
  const finalPrice = await priceOracle.getPrice();
  const lastUpdate = await priceOracle.getLastUpdateTime();
  const finalThreshold = (50000n * 10n**26n) / finalPrice;
  
  console.log(`   Final Price: $${ethers.formatUnits(finalPrice, 8)}`);
  console.log(`   Last Update: ${new Date(Number(lastUpdate) * 1000).toLocaleString()}`);
  console.log(`   Graduation Threshold: ${ethers.formatEther(finalThreshold)} CORE`);

  console.log("\n=== Demo Complete ===");
  console.log("💡 Tips for testnet usage:");
  console.log("   • Use setPrice() to test different market conditions");
  console.log("   • Higher CORE price = lower graduation threshold");
  console.log("   • Lower CORE price = higher graduation threshold");
  console.log("   • Test graduation scenarios by adjusting price before token launches");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
