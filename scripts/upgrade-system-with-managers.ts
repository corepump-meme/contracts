import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== CORE PUMP SYSTEM UPGRADE WITH MANAGER PATTERN ===");
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "CORE");
  
  // Contract addresses from your existing deployment
  const EXISTING_ADDRESSES = {
    eventHub: "0xd27C6810c589974975cC390eC1A1959862E8a85E",
    treasury: "0x17Bc6954438a8D5F1B43c9DC5e6B6C1C4D060020",
    coinFactory: "0x7766a44216a23B8BeE5A264aa4f8C4E6aaC00c68", // Will be detected or provided
  };

  try {
    console.log("\n=== STEP 1: UPGRADE EVENTHUB TO V2 ===");
    console.log("Upgrading EventHub with manager pattern...");
    
    const EventHubV2 = await ethers.getContractFactory("EventHub");
    const eventHub = await upgrades.upgradeProxy(EXISTING_ADDRESSES.eventHub, EventHubV2);
    await eventHub.waitForDeployment();
    
    const eventHubAddress = await eventHub.getAddress();
    console.log("✅ EventHub upgraded to V2 at:", eventHubAddress);
    
    // Verify version
    const version = await (eventHub as any).version();
    console.log("✅ EventHub version:", version);
    
    console.log("\n=== STEP 2: UPGRADE TREASURY TO V2 ===");
    console.log("Upgrading PlatformTreasury with manager pattern...");
    
    const PlatformTreasuryV2 = await ethers.getContractFactory("PlatformTreasury");
    const treasury = await upgrades.upgradeProxy(EXISTING_ADDRESSES.treasury, PlatformTreasuryV2);
    await treasury.waitForDeployment();
    
    const treasuryAddress = await treasury.getAddress();
    console.log("✅ PlatformTreasury upgraded to V2 at:", treasuryAddress);
    
    // Verify version
    const treasuryVersion = await (treasury as any).version();
    console.log("✅ PlatformTreasury version:", treasuryVersion);
    
    console.log("\n=== STEP 3: FIND OR DEPLOY COINFACTORY V2 ===");
    
    let coinFactory;
    let coinFactoryAddress;
    
    if (EXISTING_ADDRESSES.coinFactory) {
      console.log("Upgrading existing CoinFactory...");
      const CoinFactoryV2 = await ethers.getContractFactory("CoinFactory");
      coinFactory = await upgrades.upgradeProxy(EXISTING_ADDRESSES.coinFactory, CoinFactoryV2);
      coinFactoryAddress = await coinFactory.getAddress();
      console.log("✅ CoinFactory upgraded to V2 at:", coinFactoryAddress);
    } else {
      console.log("CoinFactory address not provided. You'll need to upgrade it separately.");
      console.log("Use: npx hardhat run scripts/upgrade-specific-coinfactory.ts --network <network>");
      coinFactoryAddress = "PLEASE_PROVIDE_COINFACTORY_ADDRESS";
    }
    
    console.log("\n=== STEP 4: SETUP MANAGER PERMISSIONS ===");
    
    if (coinFactoryAddress !== "PLEASE_PROVIDE_COINFACTORY_ADDRESS") {
      console.log("Authorizing CoinFactory as manager in EventHub...");
      try {
        const tx1 = await (eventHub as any).authorizeManager(coinFactoryAddress, true);
        await tx1.wait();
        console.log("✅ CoinFactory authorized as EventHub manager");
      } catch (error: any) {
        console.log("❌ Failed to authorize in EventHub:", error.message);
      }
      
      console.log("Authorizing CoinFactory as manager in Treasury...");
      try {
        const tx2 = await (treasury as any).authorizeManager(coinFactoryAddress, true);
        await tx2.wait();
        console.log("✅ CoinFactory authorized as Treasury manager");
      } catch (error: any) {
        console.log("❌ Failed to authorize in Treasury:", error.message);
      }
    }
    
    console.log("\n=== STEP 5: VERIFICATION ===");
    
    // Test manager permissions
    if (coinFactoryAddress !== "PLEASE_PROVIDE_COINFACTORY_ADDRESS") {
      const isEventHubManager = await (eventHub as any).authorizedManagers(coinFactoryAddress);
      const isTreasuryManager = await (treasury as any).authorizedManagers(coinFactoryAddress);
      
      console.log("EventHub Manager Status:", isEventHubManager);
      console.log("Treasury Manager Status:", isTreasuryManager);
      
      if (isEventHubManager && isTreasuryManager) {
        console.log("✅ All manager permissions configured correctly!");
      } else {
        console.log("⚠️  Manager permissions may need manual configuration");
      }
    }
    
    console.log("\n=== UPGRADE SUMMARY ===");
    console.log("EventHub V2:", eventHubAddress);
    console.log("Treasury V2:", treasuryAddress);
    console.log("CoinFactory V2:", coinFactoryAddress);
    console.log("");
    console.log("✅ System upgraded successfully!");
    console.log("");
    console.log("=== NEXT STEPS ===");
    console.log("1. Run migration script to fix existing bonding curves:");
    console.log("   npx hardhat run scripts/migrate-existing-bonding-curves.ts --network <network>");
    console.log("");
    console.log("2. Test creating a new token to verify auto-authorization works");
    console.log("");
    console.log("3. All future bonding curves will be automatically authorized!");
    
  } catch (error) {
    console.error("\n❌ UPGRADE FAILED:");
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
