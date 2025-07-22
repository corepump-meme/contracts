# CorePump Architecture Overview

## 🏗️ System Overview

CorePump is a decentralized token launch platform built on Core Chain that enables fair, anti-rug token launches through mathematical bonding curves and automated graduation mechanisms. The platform enforces strict business rules to ensure equitable distribution and prevent common token launch manipulation tactics.

### Core Principles
- **Fair Distribution**: 4% maximum purchase limits ensure no single wallet can dominate initial distribution
- **Anti-Rug Protection**: Immediate ownership renouncement and no post-creation minting capabilities
- **Mathematical Price Discovery**: Quadratic bonding curve provides transparent, predictable pricing
- **Automated Graduation**: Tokens automatically graduate to DEX trading at $50K market cap
- **Platform Sustainability**: 1% trading fees and 1 CORE creation fees fund platform operations

## 🏛️ Contract Architecture

### Core Contracts (4 Primary)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CoinFactory   │────│  BondingCurve   │────│ PlatformTreasury│
│  (Upgradeable)  │    │  (Upgradeable)  │    │  (Upgradeable)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      Coin       │    │    EventHub     │    │   Price Oracle  │
│ (Non-upgradeable)│    │  (Upgradeable)  │    │ (Interface + Impl)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### 1. CoinFactory.sol (Upgradeable)
**Role**: Main platform entry point and token creation orchestrator

**Key Responsibilities**:
- Token creation with 1 CORE fee collection
- Bonding curve proxy deployment using Clone factory pattern
- Token metadata management and validation
- Platform statistics tracking
- Emergency controls (pause/unpause)

**Architecture Pattern**: UUPS Upgradeable Proxy
- Allows platform feature updates without redeployment
- Maintains backward compatibility for existing tokens
- Owner-controlled upgrade authorization

**Key Functions**:
```solidity
function createCoin(
    string memory name,
    string memory symbol,
    string memory description,
    string memory image,
    string memory website,
    string memory telegram,
    string memory twitter
) external payable
```

#### 2. BondingCurve.sol (Upgradeable)
**Role**: Price discovery mechanism and trading engine

**Key Responsibilities**:
- Quadratic bonding curve price calculation
- Buy/sell transaction processing with 1% platform fee
- 4% purchase limit enforcement per wallet
- Graduation threshold monitoring ($50K USD equivalent)
- Automated graduation execution

**Mathematical Model**:
```
Price = basePrice × (1 + tokensSold/totalSupply)²
```

**Architecture Pattern**: UUPS Upgradeable Proxy (Clone)
- Each token gets its own bonding curve instance via Clone factory
- Minimal proxy pattern reduces deployment gas costs
- Upgradeable implementation allows trading logic improvements

**Key State Variables**:
```solidity
uint256 public constant PLATFORM_FEE = 100; // 1%
uint256 public constant MAX_PURCHASE_PERCENTAGE = 400; // 4%
uint256 public constant GRADUATION_USD_THRESHOLD = 50000; // $50K
```

#### 3. Coin.sol (Non-upgradeable)
**Role**: Standard ERC20 token with immutable properties

**Key Responsibilities**:
- Fixed 1 billion token supply
- Rich metadata storage (description, image, social links)
- Immediate ownership renouncement upon creation
- 80% supply allocation to bonding curve for public sale

**Architecture Pattern**: Standard Contract (Non-upgradeable)
- Immutability ensures token holders of contract stability
- No minting capability prevents supply manipulation
- Renounced ownership eliminates centralized control

**Supply Distribution**:
```
Total Supply: 1,000,000,000 tokens
├── 80% (800M) → Bonding Curve (Public Sale)
├── 15% (150M) → Future: Early Buyer Vesting
└── 5% (50M)   → Future: Creator Vesting
```

#### 4. PlatformTreasury.sol (Upgradeable)
**Role**: Platform fund management and fee collection

**Key Responsibilities**:
- Automated fee collection from creation and trading
- Categorized fee tracking (creation, trading, graduation)
- Withdrawal controls for platform operations
- Revenue analytics and reporting

**Architecture Pattern**: UUPS Upgradeable Proxy
- Allows treasury management improvements
- Maintains fund security through upgrade controls
- Owner-only withdrawal permissions

### Supporting Infrastructure

#### EventHub.sol (Upgradeable)
**Role**: Centralized event system for efficient indexing

**Key Responsibilities**:
- Aggregates all platform events in one contract
- Optimizes subgraph indexing performance
- Provides comprehensive platform analytics data
- Authorization system for event emission

**Events Tracked**:
- Token launches and metadata
- Trading activity (buys/sells)
- Graduation events
- Price oracle updates
- Fee collections
- Large purchase attempts

#### Oracle System
**Role**: External price feed integration for USD conversion

**Components**:
- `IPriceOracle.sol`: Standard interface for price feeds
- `API3PriceOracle.sol`: Production API3 integration
- `TestnetPriceOracle.sol`: Testnet price simulation
- `SimpleTestPriceOracle.sol`: Basic testing implementation

**Integration Pattern**:
```solidity
interface IPriceOracle {
    function getPrice() external view returns (uint256 price); // 8 decimals
    function getLastUpdateTime() external view returns (uint256 timestamp);
}
```

## 🔄 Token Lifecycle Flow

### Phase 1: Creation
```
User Pays 1 CORE → CoinFactory → Deploy Coin Contract
                              → Deploy BondingCurve Clone
                              → Mint 800M tokens to BondingCurve
                              → Renounce Coin ownership
                              → Send fee to Treasury
```

### Phase 2: Bonding Curve Trading
```
Buy Transaction:
User Sends CORE → BondingCurve → Calculate tokens via quadratic curve
                               → Check 4% purchase limit
                               → Transfer tokens to user
                               → Send 1% fee to Treasury
                               → Check graduation threshold

Sell Transaction:
User Sends Tokens → BondingCurve → Calculate CORE via quadratic curve
                                 → Transfer CORE to user (minus 1% fee)
                                 → Send fee to Treasury
```

### Phase 3: Graduation Event
```
Threshold Reached ($50K) → BondingCurve → Distribute CORE:
                                        ├── 70% → Future DEX Liquidity
                                        ├── 20% → Platform Treasury
                                        └── 10% → Token Creator
                         → Emit Graduation Event
                         → Mark as Graduated
```

### Phase 4: Post-Graduation (Future Implementation)
```
Graduated Token → DEX Trading
                → Vesting Contract Activation
                → Whale Wallet Cooldowns
                → Milestone-based Token Releases
```

## 🔧 Technical Architecture Patterns

### 1. Upgradeable Proxy Pattern (UUPS)
**Used in**: CoinFactory, BondingCurve, PlatformTreasury, EventHub

**Benefits**:
- Platform evolution without breaking existing tokens
- Gas-efficient upgrades
- Backward compatibility maintenance
- Owner-controlled upgrade authorization

**Implementation**:
```solidity
contract CoinFactory is UUPSUpgradeable, OwnableUpgradeable {
    function _authorizeUpgrade(address newImplementation) 
        internal override onlyOwner {}
}
```

### 2. Clone Factory Pattern
**Used in**: BondingCurve deployment

**Benefits**:
- Minimal deployment gas costs (~10x cheaper)
- Identical logic across all bonding curves
- Centralized upgrade capability for trading logic

**Implementation**:
```solidity
address bondingCurveProxy = bondingCurveImplementation.clone();
BondingCurve(bondingCurveProxy).initialize(/* parameters */);
```

### 3. Centralized Event System
**Used in**: EventHub for all platform events

**Benefits**:
- Efficient subgraph indexing (single contract to monitor)
- Comprehensive analytics data
- Reduced indexing complexity and costs

**Authorization Pattern**:
```solidity
modifier onlyAuthorized() {
    require(authorizedContracts[msg.sender], "EventHub: Not authorized");
    _;
}
```

### 4. Oracle Abstraction
**Used in**: Price feed integration

**Benefits**:
- Flexible price source switching
- Testnet/mainnet environment adaptation
- Future oracle provider integration

## 🛡️ Security Architecture

### Anti-Rug Protection Mechanisms

#### 1. Immediate Ownership Renouncement
```solidity
constructor(...) {
    // Token setup
    renounceOwnership(); // Called in constructor
}
```

#### 2. No Post-Creation Minting
- Fixed supply set in constructor
- No mint function in token contract
- Immutable total supply

#### 3. Purchase Limits
```solidity
uint256 maxPurchase = (totalSupply * MAX_PURCHASE_PERCENTAGE) / BASIS_POINTS;
require(purchaseAmounts[msg.sender] + tokensToReceive <= maxPurchase, 
        "Purchase exceeds 4% limit");
```

#### 4. Mathematical Price Discovery
- Transparent quadratic bonding curve
- No arbitrary price manipulation
- Predictable graduation mechanics

### Access Control Patterns

#### 1. Multi-Level Authorization
```solidity
// Platform level
modifier onlyOwner() { ... }

// Contract level  
modifier onlyAuthorized() { ... }

// Function level
modifier nonReentrant() { ... }
```

#### 2. Emergency Controls
- Pausable functionality in critical contracts
- Emergency withdrawal capabilities
- Upgrade authorization controls

## 🔌 Integration Architecture

### Frontend Integration Points

#### 1. Contract Interaction Patterns
```javascript
// Token Creation
const tx = await coinFactory.createCoin(
    name, symbol, description, image, website, telegram, twitter,
    { value: ethers.utils.parseEther("1") }
);

// Trading
const buyTx = await bondingCurve.buyTokens({ value: coreAmount });
const sellTx = await bondingCurve.sellTokens(tokenAmount);
```

#### 2. Event Monitoring
```javascript
// Listen to EventHub for all platform events
eventHub.on("TokenLaunched", (token, creator, bondingCurve, ...args) => {
    // Handle new token launch
});

eventHub.on("TokenTraded", (token, trader, isBuy, ...args) => {
    // Handle trading activity
});
```

### Subgraph Integration

#### 1. Event Schema
```graphql
type Token @entity {
  id: ID!
  name: String!
  symbol: String!
  creator: Bytes!
  bondingCurve: Bytes!
  totalRaised: BigInt!
  graduated: Boolean!
  createdAt: BigInt!
}

type Trade @entity {
  id: ID!
  token: Token!
  trader: Bytes!
  isBuy: Boolean!
  coreAmount: BigInt!
  tokenAmount: BigInt!
  timestamp: BigInt!
}
```

#### 2. Indexing Strategy
- Single EventHub contract monitoring
- Comprehensive event coverage
- Real-time platform analytics

### Oracle Integration

#### 1. Price Feed Interface
```solidity
interface IPriceOracle {
    function getPrice() external view returns (uint256); // USD price, 8 decimals
    function getLastUpdateTime() external view returns (uint256);
}
```

#### 2. Dynamic Graduation Threshold
```solidity
function getGraduationThreshold() public view returns (uint256) {
    uint256 corePrice = priceOracle.getPrice();
    return (GRADUATION_USD_THRESHOLD * 1e26) / corePrice; // $50K in CORE
}
```

## 🚀 Deployment Architecture

### Deployment Sequence
```
1. Deploy Implementation Contracts
   ├── CoinFactory Implementation
   ├── BondingCurve Implementation  
   ├── PlatformTreasury Implementation
   └── EventHub Implementation

2. Deploy Proxy Contracts
   ├── CoinFactory Proxy → Initialize
   ├── PlatformTreasury Proxy → Initialize
   └── EventHub Proxy → Initialize

3. Deploy Oracle System
   ├── Price Oracle Implementation
   └── Configure price feeds

4. Configure Authorizations
   ├── EventHub ← Authorize CoinFactory
   ├── EventHub ← Authorize BondingCurve
   └── Treasury ← Authorize fee sources

5. Verify Integration
   ├── Test token creation flow
   ├── Test trading mechanics
   └── Test graduation process
```

### Upgrade Strategy

#### 1. Staged Rollouts
- Testnet deployment and validation
- Limited mainnet beta testing
- Full production deployment

#### 2. Upgrade Process
```solidity
// 1. Deploy new implementation
// 2. Test on testnet
// 3. Propose upgrade
// 4. Execute upgrade via proxy
function upgradeTo(address newImplementation) external onlyOwner {
    _authorizeUpgrade(newImplementation);
    _upgradeToAndCall(newImplementation, "");
}
```

## 📊 System Metrics & Monitoring

### Key Performance Indicators

#### 1. Platform Metrics
- Total tokens launched
- Total trading volume (CORE)
- Total fees collected
- Graduation rate (%)
- Average time to graduation

#### 2. Token Metrics
- Market cap progression
- Holder distribution
- Trading velocity
- Price volatility

#### 3. Security Metrics
- Failed large purchase attempts
- Contract upgrade events
- Emergency pause activations

### Analytics Architecture

#### 1. On-Chain Data
- EventHub comprehensive event logging
- Treasury fee categorization
- Bonding curve state tracking

#### 2. Off-Chain Processing
- Subgraph real-time indexing
- Frontend dashboard integration
- Historical data analysis

## 🔮 Future Architecture Considerations

### Phase 2 Enhancements

#### 1. DEX Integration
```solidity
interface IDEXRouter {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
}
```

#### 2. Vesting System
```solidity
contract VestingContract {
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256[] milestones;
        bool[] milestoneReached;
    }
}
```

#### 3. Governance Integration
```solidity
interface IGovernance {
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) external returns (uint256 proposalId);
}
```

### Scalability Considerations

#### 1. Multi-Chain Support
- Cross-chain bridge integration
- Chain-specific oracle adapters
- Unified event aggregation

#### 2. Layer 2 Integration
- Optimistic rollup deployment
- State channel trading
- Batch transaction processing

## 📋 Architecture Summary

CorePump implements a robust, secure, and scalable architecture for fair token launches on Core Chain. The system combines mathematical price discovery, anti-rug protection mechanisms, and automated graduation processes to create a trustless platform for token creation and trading.

### Key Architectural Strengths

1. **Modularity**: Clear separation of concerns across contracts
2. **Upgradeability**: Strategic use of proxy patterns for evolution
3. **Security**: Multiple layers of protection against manipulation
4. **Efficiency**: Gas-optimized deployment and trading mechanisms
5. **Transparency**: Comprehensive event logging and analytics
6. **Scalability**: Clone factory pattern and centralized event system

### Technical Excellence

- **Smart Contract Best Practices**: OpenZeppelin standards, reentrancy protection, access controls
- **Gas Optimization**: Clone factory, efficient storage patterns, batch operations
- **Event Architecture**: Centralized logging for optimal indexing performance
- **Integration Patterns**: Clean interfaces for frontend and subgraph integration

The architecture provides a solid foundation for the current MVP while maintaining flexibility for future enhancements including DEX integration, vesting systems, and governance mechanisms.
