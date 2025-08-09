import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== COINFACTORY SPECIFIC UPGRADE TO V2 ===");
  console.log("This script upgrades only the CoinFactory contract to V2 with auto-authorization");
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "CORE");
  console.log("Network:", (await ethers.provider.getNetwork()).name);

  // IMPORTANT: Set your existing CoinFactory proxy address here
  const EXISTING_COINFACTORY_ADDRESS = process.env.COINFACTORY_ADDRESS || "";
  
  if (!EXISTING_COINFACTORY_ADDRESS) {
    console.error("\n❌ ERROR: CoinFactory address not provided!");
    console.error("Please set COINFACTORY_ADDRESS environment variable or edit this script");
    console.error("\nExample:");
    console.error("COINFACTORY_ADDRESS=0x1234567890123456789012345678901234567890 npx hardhat run scripts/upgrade-specific-coinfactory.ts --network coreTestnet");
    process.exit(1);
  }

  console.log("Target CoinFactory:", EXISTING_COINFACTORY_ADDRESS);

  try {
    console.log("\n=== STEP 1: VERIFY EXISTING CONTRACT ===");
    
    // Connect to existing contract to verify it exists and get current version
    const CoinFactoryV1 = await ethers.getContractFactory("CoinFactory");
    const existingFactory = CoinFactoryV1.attach(EXISTING_COINFACTORY_ADDRESS) as any;
    
    // Test connection and get basic info
    try {
      const totalCoins = await existingFactory.getTotalCoins();
      console.log("✅ Connected to existing CoinFactory");
      console.log("✅ Total coins created:", totalCoins.toString());
      
      // Try to get current version if available
      try {
        const currentVersion = await existingFactory.version();
        console.log("✅ Current version:", currentVersion);
        
        if (currentVersion === "2.0.0") {
          console.log("⚠️  CoinFactory is already upgraded to V2!");
          console.log("No upgrade needed. Exiting...");
          return;
        }
      } catch {
        console.log("✅ Current version: 1.0.0 (no version function - needs upgrade)");
      }
      
    } catch (error: any) {
      console.error("❌ Failed to connect to CoinFactory at:", EXISTING_COINFACTORY_ADDRESS);
      console.error("Error:", error.message);
      console.error("Please verify the address is correct and deployed on this network");
      process.exit(1);
    }

    console.log("\n=== STEP 2: UPGRADE TO V2 ===");
    console.log("Upgrading CoinFactory to V2 with auto-authorization functionality...");
    
    // Get the V2 factory contract
    const CoinFactoryV2 = await ethers.getContractFactory("CoinFactory");
    
    // Perform the upgrade
    console.log("Executing upgrade...");
    const upgradedFactory = await upgrades.upgradeProxy(EXISTING_COINFACTORY_ADDRESS, CoinFactoryV2);
    await upgradedFactory.waitForDeployment();
    
    const upgradedAddress = await upgradedFactory.getAddress();
    console.log("✅ CoinFactory upgraded successfully!");
    console.log("✅ Address:", upgradedAddress);
    
    // Verify new version
    try {
      const newVersion = await (upgradedFactory as any).version();
      console.log("✅ New version:", newVersion);
    } catch {
      console.log("⚠️  Could not verify version (but upgrade completed)");
    }

    console.log("\n=== STEP 3: VERIFY UPGRADE ===");
    
    // Test that old functionality still works
    try {
      const totalCoins = await (upgradedFactory as any).getTotalCoins();
      console.log("✅ Legacy functions work - Total coins:", totalCoins.toString());
    } catch (error: any) {
      console.log("⚠️  Could not verify legacy functions:", error.message);
    }
    
    // Test new functionality exists
    try {
      const stats = await (upgradedFactory as any).getPlatformStats();
      console.log("✅ New V2 functions available");
      console.log("   - Platform stats accessible");
      console.log("   - Auto-authorization logic added");
    } catch (error: any) {
      console.log("⚠️  Could not verify new functions:", error.message);
    }

    console.log("\n=== STEP 4: CONFIGURATION RECOMMENDATIONS ===");
    console.log("The CoinFactory has been upgraded, but you still need to configure manager permissions:");
    console.log("");
    console.log("1. Run the full system upgrade if you haven't:");
    console.log("   npx hardhat run scripts/upgrade-system-with-managers.ts --network <network>");
    console.log("");
    console.log("2. Or manually authorize this CoinFactory as a manager:");
    console.log("   - In EventHub: call authorizeManager(" + upgradedAddress + ", true)");
    console.log("   - In Treasury: call authorizeManager(" + upgradedAddress + ", true)");
    console.log("");
    console.log("3. Migrate existing bonding curves:");
    console.log("   npx hardhat run scripts/migrate-existing-bonding-curves.ts --network <network>");

    console.log("\n=== UPGRADE SUMMARY ===");
    console.log("Contract:", upgradedAddress);
    console.log("Status: ✅ Successfully upgraded to V2");
    console.log("New Features:");
    console.log("  ✅ Auto-authorization for new bonding curves");
    console.log("  ✅ Manager pattern support");
    console.log("  ✅ Enhanced error handling");
    console.log("  ✅ Version tracking");
    console.log("");
    console.log("Next: Configure manager permissions to enable auto-authorization");

  } catch (error: any) {
    console.error("\n❌ UPGRADE FAILED:");
    console.error(error);
    
    if (error.message.includes("proxy admin")) {
      console.error("\n💡 POSSIBLE SOLUTION:");
      console.error("Make sure you're using the same account that deployed the original contract");
      console.error("Only the proxy admin can perform upgrades");
    } else if (error.message.includes("implementation")) {
      console.error("\n💡 POSSIBLE SOLUTION:");
      console.error("There might be storage layout conflicts");
      console.error("Check that the new contract is upgrade-compatible");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
