# CorePump - Fair Token Launchpad MVP

A decentralized token launchpad built on Core Chain with bonding curve mechanics, anti-rug protection, and upgradeable smart contracts.

## 🚀 Features

### Core MVP Functionality
- **Token Creation**: Launch ERC20 tokens with fixed 1B supply and 1 CORE creation fee
- **Bonding Curve Trading**: Mathematical price discovery with quadratic bonding curve
- **Anti-Rug Protection**: Immediate ownership renouncement and LP token burning
- **Purchase Limits**: 4% maximum purchase per wallet to ensure fair distribution
- **Platform Fees**: 1% trading fee on all bonding curve transactions
- **Upgradeable Architecture**: UUPS proxy pattern for future enhancements

### Business Rules Implementation
- ✅ **1 CORE creation fee** per token launch
- ✅ **Fixed 1,000,000,000 token supply** for every coin
- ✅ **80% allocation** to bonding curve for public sale
- ✅ **1% platform fee** on all bonding curve transactions
- ✅ **4% maximum purchase limit** per wallet
- ✅ **Automatic graduation** at $50k market cap
- ✅ **Immutable tokens** with renounced ownership

## 📁 Project Structure

```
├── contracts/
│   ├── Coin.sol                 # ERC20 token template
│   ├── BondingCurve.sol         # Price discovery and trading
│   ├── CoinFactory.sol          # Main factory contract
│   └── PlatformTreasury.sol     # Fee collection and management
├── scripts/
│   └── deploy.ts                # Deployment script
├── test/
│   └── CorePump.test.ts         # Comprehensive test suite
├── ignition/
│   └── modules/
│       └── CorePumpDeploy.ts    # Hardhat Ignition deployment
└── docs/
    ├── BUSINESS_RULES.md        # Original business rules
    └── BUSINESS_RULES_V2.md     # Updated business rules
```

## 🛠 Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd corepump-hardhat
```

2. **Install dependencies**
```bash
npm install
```

3. **Compile contracts**
```bash
npm run compile
```

## 🧪 Testing

Run the comprehensive test suite:
```bash
npm test
```

The test suite covers:
- Platform setup and configuration
- Token creation with various scenarios
- Bonding curve trading mechanics
- Purchase limits and validations
- Fee collection and treasury management
- Token properties and metadata

## 🚀 Deployment

### Local Development
1. **Start Hardhat network**
```bash
npx hardhat node
```

2. **Deploy contracts**
```bash
npm run deploy:local
```

### Production Deployment
```bash
npm run deploy
```

## 📋 Contract Architecture

### Core Contracts

#### 1. CoinFactory (Upgradeable)
- **Purpose**: Main entry point for token creation
- **Features**: 
  - Creates new tokens and bonding curves
  - Manages creation fees
  - Tracks all launched tokens
  - Upgradeable via UUPS proxy

#### 2. BondingCurve (Upgradeable)
- **Purpose**: Price discovery and trading mechanism
- **Features**:
  - Quadratic bonding curve formula
  - Buy/sell functionality with slippage protection
  - 4% purchase limit enforcement
  - Automatic graduation at $50k market cap
  - Emergency pause functionality

#### 3. Coin (Non-upgradeable)
- **Purpose**: Standard ERC20 token with fixed supply
- **Features**:
  - Fixed 1B token supply
  - Immediate ownership renouncement
  - Rich metadata support
  - Immutable after creation

#### 4. PlatformTreasury (Upgradeable)
- **Purpose**: Fee collection and fund management
- **Features**:
  - Automated fee categorization
  - Withdrawal controls
  - Statistics tracking
  - Multi-contract authorization

## 🔧 Configuration

### Key Parameters
- **Creation Fee**: 1 CORE
- **Base Price**: 0.0001 CORE per token
- **Platform Fee**: 1% on all trades
- **Purchase Limit**: 4% of total supply
- **Graduation Threshold**: $50,000 market cap

### Bonding Curve Formula
```
price = basePrice * (1 + tokensSold/totalSupply)²
```

## 🔐 Security Features

- **Reentrancy Protection**: All external calls protected
- **Access Controls**: Role-based permissions
- **Emergency Pause**: Circuit breaker functionality
- **Input Validation**: Comprehensive parameter checking
- **Overflow Protection**: SafeMath equivalent operations

## 🎯 Usage Examples

### Creating a Token
```solidity
coinFactory.createCoin{value: 1 ether}(
    "My Token",
    "MTK",
    "A revolutionary token",
    "https://example.com/image.png",
    "https://mytoken.com",
    "https://t.me/mytoken",
    "https://twitter.com/mytoken"
);
```

### Buying Tokens
```solidity
bondingCurve.buyTokens{value: 0.1 ether}();
```

### Selling Tokens
```solidity
coin.approve(bondingCurveAddress, tokenAmount);
bondingCurve.sellTokens(tokenAmount);
```

## 📊 Platform Statistics

Get real-time platform metrics:
```solidity
(
    uint256 totalCoins,
    uint256 creationFee,
    uint256 basePrice,
    address treasury
) = coinFactory.getPlatformStats();
```

## 🔄 Upgrade Path

The platform is designed for future enhancements:

### Planned Features (Post-MVP)
- **DEX Integration**: Automatic liquidity provision on graduation
- **Vesting Contracts**: Milestone-based token release
- **Governance System**: Community-driven platform decisions
- **Stability Tax**: Additional revenue mechanism
- **Advanced Analytics**: Comprehensive platform metrics

### Upgrade Process
1. Deploy new implementation contract
2. Call `upgradeTo()` on proxy contract
3. Initialize new features if required
4. Update frontend integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- **Core Chain**: [Official Website](https://coredao.org/)
- **Documentation**: See `/docs` folder for detailed business rules
- **Support**: Create an issue for questions or bug reports

## ⚠️ Disclaimer

This is an MVP implementation. Conduct thorough testing and auditing before mainnet deployment. The contracts have not been professionally audited.
