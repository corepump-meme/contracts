import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
console.log("Using private key:", PRIVATE_KEY ? "****" : "No private key set");

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    coreTestnet: {
      url: "https://rpc.test2.btcs.network",
      accounts: [PRIVATE_KEY],
    },
    // Core Chain configuration can be added here later
  },
  defaultNetwork: "coreTestnet",
  etherscan: {
    apiKey: {
      coreTestnet: process.env.CORESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "coreTestnet",
        chainId: 1114,
        urls: {
          apiURL: "https://api.test2.btcs.network/api",
          browserURL: "https://scan.test2.btcs.network",
        },
      },
    ],
  },
};

export default config;
