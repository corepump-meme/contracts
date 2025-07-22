import { ethers } from "hardhat";
// @ts-ignore
import { upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Determine network and deploy appropriate price oracle
  const network = await ethers.provider.getNetwork();
  const isMainnet = network.chainId === 1116n; // Core Chain mainnet
  
  let priceOracle: any;
  let priceOracleAddress: string;

  if (isMainnet) {
    // Deploy API3 Price Oracle for mainnet
    console.log("\n1. Deploying API3 Price Oracle for mainnet...");
    const API3PriceOracle = await ethers.getContractFactory("API3PriceOracle");
    const api3ProxyAddress = "0xedcC1A9d285d6aB43f409c3265F4d67056B3f966"; // API3 CORE/USD proxy
    priceOracle = await upgrades.deployProxy(
      API3PriceOracle,
      [],
      {
        initializer: "initialize",
        kind: "uups",
        constructorArgs: [api3ProxyAddress],
      }
    );
    await priceOracle.waitForDeployment();
    priceOracleAddress = await priceOracle.getAddress();
    console.log("API3 Price Oracle deployed to:", priceOracleAddress);
  } else {
    // Deploy Testnet Price Oracle for testnet/local
    console.log("\n1. Deploying Testnet Price Oracle...");
    const TestnetPriceOracle = await ethers.getContractFactory("TestnetPriceOracle");
    const initialPrice = 100000000; // $1.00 (8 decimals)
    priceOracle = await upgrades.deployProxy(
      TestnetPriceOracle,
      [initialPrice],
      {
        initializer: "initialize",
        kind: "uups",
      }
    );
    await priceOracle.waitForDeployment();
    priceOracleAddress = await priceOracle.getAddress();
    console.log("Testnet Price Oracle deployed to:", priceOracleAddress);
    console.log("Initial CORE price set to: $1.00");
  }

  // Deploy PlatformTreasury (upgradeable)
  console.log("\n2. Deploying PlatformTreasury...");
  const PlatformTreasury = await ethers.getContractFactory("PlatformTreasury");
  const platformTreasury = await upgrades.deployProxy(PlatformTreasury, [], {
    initializer: "initialize",
    kind: "uups",
  });
  await platformTreasury.waitForDeployment();
  const treasuryAddress = await platformTreasury.getAddress();
  console.log("PlatformTreasury deployed to:", treasuryAddress);

  // Deploy BondingCurve implementation (for cloning)
  console.log("\n3. Deploying BondingCurve implementation...");
  const BondingCurve = await ethers.getContractFactory("BondingCurve");
  const bondingCurveImpl = await BondingCurve.deploy();
  await bondingCurveImpl.waitForDeployment();
  const bondingCurveImplAddress = await bondingCurveImpl.getAddress();
  console.log("BondingCurve implementation deployed to:", bondingCurveImplAddress);

  // Deploy Coin implementation (this will be used as template, not upgradeable)
  console.log("\n4. Deploying Coin implementation...");
  const Coin = await ethers.getContractFactory("Coin");
  // We need to deploy a dummy coin for the implementation
  const coinImpl = await Coin.deploy(
    "Implementation",
    "IMPL",
    deployer.address,
    deployer.address, // temporary address
    "Implementation contract",
    "",
    "",
    "",
    ""
  );
  await coinImpl.waitForDeployment();
  const coinImplAddress = await coinImpl.getAddress();
  console.log("Coin implementation deployed to:", coinImplAddress);

  // Deploy EventHub (upgradeable)
  console.log("\n5. Deploying EventHub...");
  const EventHub = await ethers.getContractFactory("EventHub");
  const eventHub = await upgrades.deployProxy(EventHub, [], {
    initializer: "initialize",
    kind: "uups",
  });
  await eventHub.waitForDeployment();
  const eventHubAddress = await eventHub.getAddress();
  console.log("EventHub deployed to:", eventHubAddress);

  // Deploy CoinFactory (upgradeable)
  console.log("\n6. Deploying CoinFactory...");
  const CoinFactory = await ethers.getContractFactory("CoinFactory");
  const coinFactory = await upgrades.deployProxy(
    CoinFactory,
    [treasuryAddress, coinImplAddress, bondingCurveImplAddress, priceOracleAddress, eventHubAddress],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );
  await coinFactory.waitForDeployment();
  const factoryAddress = await coinFactory.getAddress();
  console.log("CoinFactory deployed to:", factoryAddress);

  // Authorize CoinFactory in PlatformTreasury
  console.log("\n7. Authorizing CoinFactory in PlatformTreasury...");
  await platformTreasury.authorizeContract(factoryAddress, true);
  console.log("CoinFactory authorized in PlatformTreasury");

  // Authorize CoinFactory in EventHub
  console.log("\n8. Authorizing CoinFactory in EventHub...");
  await eventHub.authorizeContract(factoryAddress, true);
  console.log("CoinFactory authorized in EventHub");

  // Get platform stats
  console.log("\n9. Getting platform stats...");
  const stats = await coinFactory.getPlatformStats();
  console.log("Platform Stats:");
  console.log("- Total Coins:", stats[0].toString());
  console.log("- Creation Fee:", ethers.formatEther(stats[1]), "CORE");
  console.log("- Base Price:", ethers.formatEther(stats[2]), "CORE per token");
  console.log("- Treasury Address:", stats[3]);

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("PlatformTreasury:", treasuryAddress);
  console.log("EventHub:", eventHubAddress);
  console.log("BondingCurve Implementation:", bondingCurveImplAddress);
  console.log("Coin Implementation:", coinImplAddress);
  console.log("CoinFactory:", factoryAddress);
  console.log("Deployer:", deployer.address);
  
  console.log("\n=== NEXT STEPS ===");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Test token creation through CoinFactory");
  console.log("3. Test bonding curve trading");
  console.log("4. Set up frontend integration");

  // Get current CORE price from oracle
  const currentPrice = await priceOracle.getPrice();
  const graduationThreshold = (50000n * 10n**26n) / currentPrice; // $50k worth of CORE
  
  console.log("\n=== PRICE ORACLE INFO ===");
  console.log("Price Oracle Type:", isMainnet ? "API3" : "Testnet");
  console.log("Price Oracle Address:", priceOracleAddress);
  console.log("Current CORE Price:", ethers.formatUnits(currentPrice, 8), "USD");
  console.log("Graduation Threshold:", ethers.formatEther(graduationThreshold), "CORE");

  // Save deployment addresses to a file
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    contracts: {
      PriceOracle: priceOracleAddress,
      PlatformTreasury: treasuryAddress,
      EventHub: eventHubAddress,
      BondingCurveImplementation: bondingCurveImplAddress,
      CoinImplementation: coinImplAddress,
      CoinFactory: factoryAddress,
    },
    priceInfo: {
      oracleType: isMainnet ? "API3" : "Testnet",
      currentPrice: ethers.formatUnits(currentPrice, 8),
      graduationThreshold: ethers.formatEther(graduationThreshold),
    },
    timestamp: new Date().toISOString(),
  };

  console.log("\n=== DEPLOYMENT INFO ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
