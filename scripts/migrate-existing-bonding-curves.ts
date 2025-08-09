import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== EXISTING BONDING CURVES MIGRATION ===");
  console.log("This script will authorize all existing bonding curves");
  console.log("Deployer address:", deployer.address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  
  // Contract addresses from your existing deployment
  const ADDRESSES = {
    eventHub: "0xd27C6810c589974975cC390eC1A1959862E8a85E",
    treasury: "0x17Bc6954438a8D5F1B43c9DC5e6B6C1C4D060020",
    coinFactory: "0x7766a44216a23B8BeE5A264aa4f8C4E6aaC00c68", // Will be provided or detected
    bondingCurve: "0x00172e9c8c6546fc009c2fbd1e55b7a70cca1e9f", // The problematic one from your error
  };

  try {
    console.log("\n=== STEP 1: CONNECT TO CONTRACTS ===");
    
    // Connect to EventHub
    const EventHub = await ethers.getContractFactory("EventHub");
    const eventHub = EventHub.attach(ADDRESSES.eventHub) as any;
    console.log("✅ Connected to EventHub at:", ADDRESSES.eventHub);
    
    // Connect to Treasury
    const Treasury = await ethers.getContractFactory("PlatformTreasury");
    const treasury = Treasury.attach(ADDRESSES.treasury) as any;
    console.log("✅ Connected to PlatformTreasury at:", ADDRESSES.treasury);
    
    console.log("\n=== STEP 2: FIND BONDING CURVES TO MIGRATE ===");
    
    // List of bonding curves to migrate
    let bondingCurvesToMigrate = [];
    
    // Add the specific problematic bonding curve
    if (ADDRESSES.bondingCurve) {
      bondingCurvesToMigrate.push(ADDRESSES.bondingCurve);
      console.log("✅ Added specific bonding curve:", ADDRESSES.bondingCurve);
    }
    
    // If CoinFactory is available, get all bonding curves from it
    if (ADDRESSES.coinFactory) {
      try {
        const CoinFactory = await ethers.getContractFactory("CoinFactory");
        const coinFactory = CoinFactory.attach(ADDRESSES.coinFactory) as any;
        
        const totalCoins = await coinFactory.getTotalCoins();
        console.log("✅ Found", totalCoins.toString(), "total coins in factory");
        
        for (let i = 0; i < Number(totalCoins); i++) {
          try {
            const coinInfo = await coinFactory.getCoinByIndex(i);
            const bondingCurveAddress = coinInfo[1]; // bondingCurve is second element
            if (bondingCurveAddress && !bondingCurvesToMigrate.includes(bondingCurveAddress)) {
              bondingCurvesToMigrate.push(bondingCurveAddress);
            }
          } catch (error) {
            console.log(`⚠️  Could not get coin at index ${i}`);
          }
        }
      } catch (error) {
        console.log("⚠️  Could not connect to CoinFactory - will migrate specific addresses only");
      }
    }
    
    console.log(`\n✅ Found ${bondingCurvesToMigrate.length} bonding curves to migrate:`);
    bondingCurvesToMigrate.forEach((addr, i) => {
      console.log(`   ${i + 1}. ${addr}`);
    });
    
    if (bondingCurvesToMigrate.length === 0) {
      console.log("⚠️  No bonding curves found to migrate!");
      console.log("Add specific addresses to ADDRESSES.bondingCurve in the script");
      return;
    }
    
    console.log("\n=== STEP 3: CHECK CURRENT AUTHORIZATION STATUS ===");
    
    const authStatus = [];
    for (const bcAddress of bondingCurvesToMigrate) {
      try {
        const eventHubAuth = await eventHub.authorizedContracts(bcAddress);
        const treasuryAuth = await treasury.authorizedContracts(bcAddress);
        
        authStatus.push({
          address: bcAddress,
          eventHub: eventHubAuth,
          treasury: treasuryAuth,
          needsAuth: !eventHubAuth || !treasuryAuth
        });
        
        console.log(`${bcAddress}:`);
        console.log(`   EventHub: ${eventHubAuth ? '✅ Authorized' : '❌ Not Authorized'}`);
        console.log(`   Treasury: ${treasuryAuth ? '✅ Authorized' : '❌ Not Authorized'}`);
      } catch (error) {
        console.log(`❌ Error checking ${bcAddress}:`, error);
      }
    }
    
    const needsAuthorization = authStatus.filter(item => item.needsAuth);
    console.log(`\n${needsAuthorization.length} bonding curves need authorization`);
    
    if (needsAuthorization.length === 0) {
      console.log("✅ All bonding curves are already authorized!");
      return;
    }
    
    console.log("\n=== STEP 4: AUTHORIZE BONDING CURVES ===");
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const item of needsAuthorization) {
      console.log(`\nProcessing ${item.address}...`);
      
      // Authorize in EventHub if needed
      if (!item.eventHub) {
        try {
          console.log("   Authorizing in EventHub...");
          const tx1 = await eventHub.authorizeContract(item.address, true);
          await tx1.wait();
          console.log("   ✅ EventHub authorization successful");
        } catch (error: any) {
          console.log("   ❌ EventHub authorization failed:", error.message);
          errorCount++;
          continue;
        }
      }
      
      // Authorize in Treasury if needed
      if (!item.treasury) {
        try {
          console.log("   Authorizing in Treasury...");
          const tx2 = await treasury.authorizeContract(item.address, true);
          await tx2.wait();
          console.log("   ✅ Treasury authorization successful");
        } catch (error: any) {
          console.log("   ❌ Treasury authorization failed:", error.message);
          errorCount++;
          continue;
        }
      }
      
      successCount++;
      console.log(`   ✅ ${item.address} fully authorized!`);
    }
    
    console.log("\n=== STEP 5: VERIFICATION ===");
    
    // Re-check authorization status
    for (const bcAddress of bondingCurvesToMigrate) {
      try {
        const eventHubAuth = await eventHub.authorizedContracts(bcAddress);
        const treasuryAuth = await treasury.authorizedContracts(bcAddress);
        
        console.log(`${bcAddress}:`);
        console.log(`   EventHub: ${eventHubAuth ? '✅' : '❌'}`);
        console.log(`   Treasury: ${treasuryAuth ? '✅' : '❌'}`);
        
        if (eventHubAuth && treasuryAuth) {
          console.log(`   🎉 READY FOR TRADING!`);
        }
      } catch (error: any) {
        console.log(`❌ Error verifying ${bcAddress}:`, error.message);
      }
    }
    
    console.log("\n=== MIGRATION SUMMARY ===");
    console.log("Total bonding curves found:", bondingCurvesToMigrate.length);
    console.log("Successfully authorized:", successCount);
    console.log("Failed authorizations:", errorCount);
    
    if (successCount > 0) {
      console.log("\n🎉 MIGRATION SUCCESSFUL!");
      console.log("The following bonding curves should now work:");
      console.log("- buyTokens() function will work");
      console.log("- No more 'circuit breaker is open' errors");
      console.log("- Events will be properly emitted");
      console.log("- Fees will be properly collected");
    }
    
    if (errorCount > 0) {
      console.log("\n⚠️  PARTIAL SUCCESS");
      console.log("Some authorizations failed. Check the errors above.");
      console.log("You may need to run this script again or fix permissions manually.");
    }
    
    console.log("\n=== NEXT STEPS ===");
    console.log("1. Test the buyTokens() function on the migrated contracts");
    console.log("2. Verify that new tokens created will auto-authorize");
    console.log("3. Monitor for any remaining authorization issues");
    
  } catch (error: any) {
    console.error("\n❌ MIGRATION FAILED:");
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
