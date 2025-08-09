import { ethers } from "hardhat";

async function main() {
  // Contract addresses from the investigation
  const BONDING_CURVE_ADDRESS = "0x00172e9c8c6546fc009c2fbd1e55b7a70cca1e9f";
  const EVENT_HUB_ADDRESS = "0xd27C6810c589974975cC390eC1A1959862E8a85E";
  const TREASURY_ADDRESS = "0x17Bc6954438a8D5F1B43c9DC5e6B6C1C4D060020";
  
  const [signer] = await ethers.getSigners();
  
  console.log("=== FIXING AUTHORIZATION ISSUE ===");
  console.log("The 'circuit breaker' error was actually 'EventHub: Not authorized'");
  console.log("We need to authorize the BondingCurve contract in EventHub and Treasury");
  console.log("");
  console.log("BondingCurve Address:", BONDING_CURVE_ADDRESS);
  console.log("EventHub Address:", EVENT_HUB_ADDRESS);
  console.log("Treasury Address:", TREASURY_ADDRESS);
  console.log("Signer Address:", signer.address);

  let successCount = 0;
  let totalOperations = 2;

  try {
    // 1. Authorize in EventHub
    console.log("\n=== AUTHORIZING IN EVENTHUB ===");
    try {
      const EventHub = await ethers.getContractFactory("EventHub");
      const eventHub = EventHub.attach(EVENT_HUB_ADDRESS) as any;
      
      // Check current owner
      const eventHubOwner = await eventHub.owner();
      console.log("✅ EventHub Owner:", eventHubOwner);
      console.log("✅ Is Signer Owner:", eventHubOwner.toLowerCase() === signer.address.toLowerCase());
      
      if (eventHubOwner.toLowerCase() !== signer.address.toLowerCase()) {
        console.log("❌ ERROR: You are not the EventHub owner!");
        console.log("   Only the owner can authorize contracts");
        console.log("   Contact the owner:", eventHubOwner);
      } else {
        // Check current authorization status
        const isCurrentlyAuthorized = await eventHub.authorizedContracts(BONDING_CURVE_ADDRESS);
        console.log("✅ Currently Authorized:", isCurrentlyAuthorized);
        
        if (isCurrentlyAuthorized) {
          console.log("✅ BondingCurve is already authorized in EventHub");
          successCount++;
        } else {
          console.log("🔧 Authorizing BondingCurve in EventHub...");
          const tx = await eventHub.authorizeContract(BONDING_CURVE_ADDRESS, true);
          console.log("   Transaction hash:", tx.hash);
          
          const receipt = await tx.wait();
          console.log("   Transaction confirmed in block:", receipt?.blockNumber);
          
          // Verify authorization
          const isNowAuthorized = await eventHub.authorizedContracts(BONDING_CURVE_ADDRESS);
          if (isNowAuthorized) {
            console.log("✅ SUCCESS: BondingCurve authorized in EventHub!");
            successCount++;
          } else {
            console.log("❌ ERROR: Authorization failed!");
          }
        }
      }
      
    } catch (error: any) {
      console.log("❌ EventHub authorization failed:", error.message);
    }
    
    // 2. Authorize in Treasury
    console.log("\n=== AUTHORIZING IN TREASURY ===");
    try {
      const Treasury = await ethers.getContractFactory("PlatformTreasury");
      const treasury = Treasury.attach(TREASURY_ADDRESS) as any;
      
      // Check current owner
      const treasuryOwner = await treasury.owner();
      console.log("✅ Treasury Owner:", treasuryOwner);
      console.log("✅ Is Signer Owner:", treasuryOwner.toLowerCase() === signer.address.toLowerCase());
      
      if (treasuryOwner.toLowerCase() !== signer.address.toLowerCase()) {
        console.log("❌ ERROR: You are not the Treasury owner!");
        console.log("   Only the owner can authorize contracts");
        console.log("   Contact the owner:", treasuryOwner);
      } else {
        // Check current authorization status
        const isCurrentlyAuthorized = await treasury.authorizedContracts(BONDING_CURVE_ADDRESS);
        console.log("✅ Currently Authorized:", isCurrentlyAuthorized);
        
        if (isCurrentlyAuthorized) {
          console.log("✅ BondingCurve is already authorized in Treasury");
          successCount++;
        } else {
          console.log("🔧 Authorizing BondingCurve in Treasury...");
          const tx = await treasury.authorizeContract(BONDING_CURVE_ADDRESS, true);
          console.log("   Transaction hash:", tx.hash);
          
          const receipt = await tx.wait();
          console.log("   Transaction confirmed in block:", receipt?.blockNumber);
          
          // Verify authorization
          const isNowAuthorized = await treasury.authorizedContracts(BONDING_CURVE_ADDRESS);
          if (isNowAuthorized) {
            console.log("✅ SUCCESS: BondingCurve authorized in Treasury!");
            successCount++;
          } else {
            console.log("❌ ERROR: Authorization failed!");
          }
        }
      }
      
    } catch (error: any) {
      console.log("❌ Treasury authorization failed:", error.message);
    }
    
    // 3. Test the fix
    console.log("\n=== TESTING THE FIX ===");
    if (successCount === totalOperations) {
      console.log("✅ All authorizations complete! Testing buyTokens...");
      
      try {
        const BondingCurve = await ethers.getContractFactory("BondingCurve");
        const bondingCurve = BondingCurve.attach(BONDING_CURVE_ADDRESS) as any;
        
        const testAmount = ethers.parseEther("0.01");
        const gasEstimate = await bondingCurve.buyTokens.estimateGas({
          value: testAmount,
          from: signer.address
        });
        
        console.log("✅ GAS ESTIMATION SUCCESS:", gasEstimate.toString());
        console.log("🎉 The buyTokens() function should now work!");
        console.log("   The 'circuit breaker' error has been resolved!");
        
      } catch (testError: any) {
        console.log("❌ Test still failed:", testError.message);
        console.log("   There might be additional issues to resolve");
      }
      
    } else {
      console.log("⚠️  Partial success:", successCount, "/", totalOperations, "operations completed");
      console.log("   The buyTokens() function may still fail until all authorizations are fixed");
    }
    
    console.log("\n=== SUMMARY ===");
    console.log("The 'circuit breaker is open' error was actually a misleading error message.");
    console.log("The real issue was: 'EventHub: Not authorized'");
    console.log("");
    console.log("Root Cause: The BondingCurve contract was not authorized to:");
    console.log("1. Emit events through EventHub");
    console.log("2. Send fees to Treasury");
    console.log("");
    console.log("This caused the buyTokens() function to revert during execution,");
    console.log("which viem interpreted as a 'circuit breaker' error.");
    console.log("");
    if (successCount === totalOperations) {
      console.log("✅ RESOLUTION: All authorizations have been fixed!");
      console.log("   Your buyTokens() function should now work normally.");
    } else {
      console.log("⚠️  NEXT STEPS: Contact the contract owners to complete authorization:");
      console.log("   EventHub owner needs to authorize:", BONDING_CURVE_ADDRESS);
      console.log("   Treasury owner needs to authorize:", BONDING_CURVE_ADDRESS);
    }
    
  } catch (error: any) {
    console.error("\n❌ CRITICAL ERROR:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
