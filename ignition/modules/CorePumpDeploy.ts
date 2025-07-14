import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CorePumpModule = buildModule("CorePumpModule", (m) => {
  // Deploy implementation contracts first
  const coinImplementation = m.contract("Coin", [
    "Implementation", // name
    "IMPL", // symbol
    m.getAccount(0), // creator (will be overridden in actual deployments)
    m.getAccount(0), // bonding curve (will be overridden in actual deployments)
    "Implementation contract", // description
    "", // image
    "", // website
    "", // telegram
    "", // twitter
  ]);

  const bondingCurveImplementation = m.contract("BondingCurve");

  // Deploy platform treasury
  const platformTreasury = m.contract("PlatformTreasury");

  // Deploy coin factory
  const coinFactory = m.contract("CoinFactory");

  return {
    coinImplementation,
    bondingCurveImplementation,
    platformTreasury,
    coinFactory,
  };
});

export default CorePumpModule;
