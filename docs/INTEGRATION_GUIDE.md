# CorePump Integration Guide

A comprehensive guide for integrating with the CorePump token launchpad platform on Core Chain.

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Contracts](#architecture--contracts)
3. [EventHub Integration](#eventhub-integration)
4. [Frontend Integration](#frontend-integration)
5. [Subgraph Integration](#subgraph-integration)
6. [Third-Party Integration](#third-party-integration)
7. [Security & Best Practices](#security--best-practices)
8. [Code Examples](#code-examples)
9. [Testing & Deployment](#testing--deployment)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

CorePump is a decentralized token launchpad built on Core Chain featuring:

- **Fair Token Launches**: 4% purchase limits and bonding curve price discovery
- **Anti-Rug Protection**: Immediate ownership renouncement and LP token burning
- **Centralized Events**: EventHub system for unified analytics and monitoring
- **Upgradeable Architecture**: UUPS proxy pattern for future enhancements
- **Production Ready**: 54 passing tests with comprehensive security measures

### Key Business Rules
- **1 CORE creation fee** per token launch
- **1,000,000,000 fixed supply** for every token
- **1% platform fee** on all bonding curve trades
- **$50,000 graduation threshold** to DEX
- **Immutable tokens** with renounced ownership

---

## 🏗 Architecture & Contracts

### Core Contract System (5 Contracts)

#### 1. **CoinFactory.sol** (Upgradeable)
- **Purpose**: Main entry point for token creation
- **Key Functions**:
  - `createCoin()` - Launch new tokens
  - `getAllCoins()` - Get all launched tokens
  - `getCoinDetails()` - Get token metadata
- **Events**: `CoinCreated`

#### 2. **BondingCurve.sol** (Upgradeable)
- **Purpose**: Price discovery and trading mechanism
- **Key Functions**:
  - `buyTokens()` - Purchase tokens from curve
  - `sellTokens()` - Sell tokens back to curve
  - `getCurrentPrice()` - Get current token price
  - `getState()` - Get curve state and statistics
- **Events**: `TokenPurchased`, `TokenSold`

#### 3. **Coin.sol** (Non-upgradeable)
- **Purpose**: Standard ERC20 token implementation
- **Features**: Fixed supply, renounced ownership, rich metadata
- **Key Functions**: Standard ERC20 + `getTokenMetadata()`

#### 4. **PlatformTreasury.sol** (Upgradeable)
- **Purpose**: Fee collection and fund management
- **Key Functions**:
  - `getTreasuryStats()` - Platform statistics
  - `withdrawAll()` - Owner fund withdrawal
- **Events**: `FundsReceived`, `FundsWithdrawn`

#### 5. **EventHub.sol** (Upgradeable) ⭐ **NEW**
- **Purpose**: Centralized event aggregation for analytics
- **Key Functions**:
  - `emitTokenLaunched()` - Token creation events
  - `emitTokenTraded()` - Trading events
  - `emitTokenGraduated()` - Graduation events
- **Events**: 7 comprehensive event types (see EventHub section)

### Contract Addresses

```typescript
// Example deployment addresses (update with actual addresses)
const CONTRACTS = {
  CoinFactory: "0x...",
  EventHub: "0x...",
  PlatformTreasury: "0x...",
  // BondingCurve addresses are created dynamically per token
};
```

---

## 🎪 EventHub Integration

### **Revolutionary Event System**

The EventHub provides a **single source of truth** for all platform events, eliminating the need for complex multi-contract indexing.

#### **Event Types (7 Total)**

```solidity
// 1. Token Launch Events
event TokenLaunched(
    address indexed token,
    address indexed creator,
    address indexed bondingCurve,
    string name,
    string symbol,
    uint256 timestamp,
    uint256 creationFee
);

// 2. Trading Events
event TokenTraded(
    address indexed token,
    address indexed trader,
    address indexed bondingCurve,
    bool isBuy,
    uint256 coreAmount,
    uint256 tokenAmount,
    uint256 newPrice,
    uint256 fee,
    uint256 timestamp
);

// 3. Graduation Events
event TokenGraduated(
    address indexed token,
    address indexed bondingCurve,
    uint256 finalPrice,
    uint256 totalRaised,
    uint256 liquidityAmount,
    uint256 timestamp
);

// 4. Price Oracle Updates
event PriceOracleUpdated(
    address indexed oracle,
    uint256 oldPrice,
    uint256 newPrice,
    uint256 timestamp
);

// 5. Platform Fee Collection
event PlatformFeeCollected(
    address indexed token,
    address indexed bondingCurve,
    string feeType,
    uint256 amount,
    uint256 timestamp
);

// 6. Large Purchase Attempts (4% limit violations)
event LargePurchaseAttempted(
    address indexed token,
    address indexed buyer,
    address indexed bondingCurve,
    uint256 attemptedAmount,
    uint256 currentHoldings,
    uint256 maxAllowed,
    uint256 timestamp
);

// 7. Graduation Threshold Updates
event GraduationThresholdUpdated(
    address indexed bondingCurve,
    uint256 oldThreshold,
    uint256 newThreshold,
    uint256 timestamp
);
```

#### **EventHub Benefits**

- **🎯 Single Subgraph**: Index one contract instead of hundreds
- **⚡ Real-time Analytics**: Platform-wide statistics instantly available
- **🔄 Cross-token Correlation**: Analyze relationships between tokens
- **📊 Unified Dashboard**: Build comprehensive analytics easily
- **🚀 Auto-discovery**: New tokens automatically indexed

---

## 💻 Frontend Integration

### **Web3 Setup**

```typescript
import { ethers } from 'ethers';
import { CoinFactory__factory, EventHub__factory } from './typechain';

// Initialize provider
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

// Initialize contracts
const coinFactory = CoinFactory__factory.connect(CONTRACTS.CoinFactory, signer);
const eventHub = EventHub__factory.connect(CONTRACTS.EventHub, provider);
```

### **React Hooks for Common Operations**

```typescript
// useTokenCreation.ts
import { useState } from 'react';
import { ethers } from 'ethers';

export const useTokenCreation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createToken = async (tokenData: {
    name: string;
    symbol: string;
    description: string;
    image: string;
    website: string;
    telegram: string;
    twitter: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const tx = await coinFactory.createCoin(
        tokenData.name,
        tokenData.symbol,
        tokenData.description,
        tokenData.image,
        tokenData.website,
        tokenData.telegram,
        tokenData.twitter,
        { value: ethers.utils.parseEther("1") } // 1 CORE creation fee
      );

      const receipt = await tx.wait();
      
      // Extract token address from events
      const event = receipt.events?.find(e => e.event === 'CoinCreated');
      const tokenAddress = event?.args?.coin;

      return { tokenAddress, txHash: receipt.transactionHash };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createToken, loading, error };
};
```

```typescript
// useTokenTrading.ts
export const useTokenTrading = (bondingCurveAddress: string) => {
  const [loading, setLoading] = useState(false);
  
  const bondingCurve = BondingCurve__factory.connect(bondingCurveAddress, signer);

  const buyTokens = async (coreAmount: string) => {
    setLoading(true);
    try {
      const tx = await bondingCurve.buyTokens({
        value: ethers.utils.parseEther(coreAmount)
      });
      return await tx.wait();
    } finally {
      setLoading(false);
    }
  };

  const sellTokens = async (tokenAmount: string) => {
    setLoading(true);
    try {
      // First approve the bonding curve to spend tokens
      const tokenContract = Coin__factory.connect(tokenAddress, signer);
      const approveTx = await tokenContract.approve(
        bondingCurveAddress,
        ethers.utils.parseEther(tokenAmount)
      );
      await approveTx.wait();

      // Then sell the tokens
      const tx = await bondingCurve.sellTokens(
        ethers.utils.parseEther(tokenAmount)
      );
      return await tx.wait();
    } finally {
      setLoading(false);
    }
  };

  return { buyTokens, sellTokens, loading };
};
```

### **Real-time Event Listening**

```typescript
// useEventHub.ts
export const useEventHub = () => {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    // Listen for new token launches
    const tokenLaunchedFilter = eventHub.filters.TokenLaunched();
    eventHub.on(tokenLaunchedFilter, (token, creator, bondingCurve, name, symbol, timestamp, fee) => {
      setEvents(prev => [...prev, {
        type: 'TokenLaunched',
        token,
        creator,
        bondingCurve,
        name,
        symbol,
        timestamp: timestamp.toNumber(),
        fee: ethers.utils.formatEther(fee)
      }]);
    });

    // Listen for trading events
    const tokenTradedFilter = eventHub.filters.TokenTraded();
    eventHub.on(tokenTradedFilter, (token, trader, bondingCurve, isBuy, coreAmount, tokenAmount, newPrice, fee, timestamp) => {
      setEvents(prev => [...prev, {
        type: 'TokenTraded',
        token,
        trader,
        bondingCurve,
        isBuy,
        coreAmount: ethers.utils.formatEther(coreAmount),
        tokenAmount: ethers.utils.formatEther(tokenAmount),
        newPrice: ethers.utils.formatEther(newPrice),
        fee: ethers.utils.formatEther(fee),
        timestamp: timestamp.toNumber()
      }]);
    });

    return () => {
      eventHub.removeAllListeners();
    };
  }, []);

  return { events };
};
```

---

## 📊 Subgraph Integration

### **Single Subgraph Architecture**

With EventHub, you only need **one subgraph** to index the entire platform:

```yaml
# subgraph.yaml
specVersion: 0.0.4
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: EventHub
    network: core
    source:
      address: "0x..." # EventHub contract address
      abi: EventHub
      startBlock: 12345678
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.6
      language: wasm/assemblyscript
      entities:
        - Token
        - Trade
        - User
        - Platform
      abis:
        - name: EventHub
          file: ./abis/EventHub.json
      eventHandlers:
        - event: TokenLaunched(indexed address,indexed address,indexed address,string,string,uint256,uint256)
          handler: handleTokenLaunched
        - event: TokenTraded(indexed address,indexed address,indexed address,bool,uint256,uint256,uint256,uint256,uint256)
          handler: handleTokenTraded
        - event: TokenGraduated(indexed address,indexed address,uint256,uint256,uint256,uint256)
          handler: handleTokenGraduated
      file: ./src/mapping.ts
```

### **GraphQL Schema**

```graphql
# schema.graphql
type Token @entity {
  id: ID!
  address: Bytes!
  name: String!
  symbol: String!
  creator: User!
  bondingCurve: Bytes!
  createdAt: BigInt!
  creationFee: BigDecimal!
  
  # Trading data
  totalVolume: BigDecimal!
  totalTrades: BigInt!
  currentPrice: BigDecimal!
  marketCap: BigDecimal!
  
  # Status
  isGraduated: Boolean!
  graduatedAt: BigInt
  
  # Relations
  trades: [Trade!]! @derivedFrom(field: "token")
}

type Trade @entity {
  id: ID!
  token: Token!
  trader: User!
  isBuy: Boolean!
  coreAmount: BigDecimal!
  tokenAmount: BigDecimal!
  price: BigDecimal!
  fee: BigDecimal!
  timestamp: BigInt!
  blockNumber: BigInt!
  transactionHash: Bytes!
}

type User @entity {
  id: ID!
  address: Bytes!
  tokensCreated: [Token!]! @derivedFrom(field: "creator")
  trades: [Trade!]! @derivedFrom(field: "trader")
  totalVolume: BigDecimal!
  totalTrades: BigInt!
}

type Platform @entity {
  id: ID!
  totalTokens: BigInt!
  totalVolume: BigDecimal!
  totalFees: BigDecimal!
  totalUsers: BigInt!
}
```

### **Mapping Functions**

```typescript
// src/mapping.ts
import { TokenLaunched, TokenTraded, TokenGraduated } from '../generated/EventHub/EventHub';
import { Token, Trade, User, Platform } from '../generated/schema';
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';

export function handleTokenLaunched(event: TokenLaunched): void {
  // Create token entity
  let token = new Token(event.params.token.toHex());
  token.address = event.params.token;
  token.name = event.params.name;
  token.symbol = event.params.symbol;
  token.bondingCurve = event.params.bondingCurve;
  token.createdAt = event.params.timestamp;
  token.creationFee = event.params.creationFee.toBigDecimal();
  token.totalVolume = BigDecimal.fromString('0');
  token.totalTrades = BigInt.fromI32(0);
  token.isGraduated = false;

  // Create or update user
  let user = User.load(event.params.creator.toHex());
  if (!user) {
    user = new User(event.params.creator.toHex());
    user.address = event.params.creator;
    user.totalVolume = BigDecimal.fromString('0');
    user.totalTrades = BigInt.fromI32(0);
  }
  token.creator = user.id;
  user.save();

  // Update platform stats
  let platform = Platform.load('platform');
  if (!platform) {
    platform = new Platform('platform');
    platform.totalTokens = BigInt.fromI32(0);
    platform.totalVolume = BigDecimal.fromString('0');
    platform.totalFees = BigDecimal.fromString('0');
    platform.totalUsers = BigInt.fromI32(0);
  }
  platform.totalTokens = platform.totalTokens.plus(BigInt.fromI32(1));
  platform.save();

  token.save();
}

export function handleTokenTraded(event: TokenTraded): void {
  // Create trade entity
  let tradeId = event.transaction.hash.toHex() + '-' + event.logIndex.toString();
  let trade = new Trade(tradeId);
  trade.token = event.params.token.toHex();
  trade.trader = event.params.trader.toHex();
  trade.isBuy = event.params.isBuy;
  trade.coreAmount = event.params.coreAmount.toBigDecimal();
  trade.tokenAmount = event.params.tokenAmount.toBigDecimal();
  trade.price = event.params.newPrice.toBigDecimal();
  trade.fee = event.params.fee.toBigDecimal();
  trade.timestamp = event.params.timestamp;
  trade.blockNumber = event.block.number;
  trade.transactionHash = event.transaction.hash;

  // Update token stats
  let token = Token.load(event.params.token.toHex());
  if (token) {
    token.totalVolume = token.totalVolume.plus(trade.coreAmount);
    token.totalTrades = token.totalTrades.plus(BigInt.fromI32(1));
    token.currentPrice = trade.price;
    token.save();
  }

  // Update user stats
  let user = User.load(event.params.trader.toHex());
  if (!user) {
    user = new User(event.params.trader.toHex());
    user.address = event.params.trader;
    user.totalVolume = BigDecimal.fromString('0');
    user.totalTrades = BigInt.fromI32(0);
  }
  user.totalVolume = user.totalVolume.plus(trade.coreAmount);
  user.totalTrades = user.totalTrades.plus(BigInt.fromI32(1));
  user.save();

  trade.save();
}
```

### **GraphQL Queries**

```graphql
# Get all tokens with trading data
query GetTokens($first: Int!, $skip: Int!) {
  tokens(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
    id
    address
    name
    symbol
    creator {
      address
    }
    createdAt
    totalVolume
    totalTrades
    currentPrice
    isGraduated
  }
}

# Get token trading history
query GetTokenTrades($tokenId: ID!, $first: Int!) {
  trades(
    where: { token: $tokenId }
    first: $first
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    trader {
      address
    }
    isBuy
    coreAmount
    tokenAmount
    price
    timestamp
  }
}

# Get platform statistics
query GetPlatformStats {
  platform(id: "platform") {
    totalTokens
    totalVolume
    totalFees
    totalUsers
  }
}

# Get user activity
query GetUserActivity($userAddress: Bytes!) {
  user(id: $userAddress) {
    address
    totalVolume
    totalTrades
    tokensCreated {
      name
      symbol
      totalVolume
    }
    trades(first: 10, orderBy: timestamp, orderDirection: desc) {
      token {
        name
        symbol
      }
      isBuy
      coreAmount
      timestamp
    }
  }
}
```

---

## 🔌 Third-Party Integration

### **Trading Bot Integration**

```python
# Python trading bot example
import asyncio
import json
from web3 import Web3
from web3.middleware import geth_poa_middleware

class CorePumpBot:
    def __init__(self, rpc_url, private_key):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        self.account = self.w3.eth.account.from_key(private_key)
        
        # Load contract ABIs and addresses
        with open('EventHub.json') as f:
            self.event_hub_abi = json.load(f)['abi']
        
        self.event_hub = self.w3.eth.contract(
            address='0x...', # EventHub address
            abi=self.event_hub_abi
        )
    
    async def monitor_new_tokens(self):
        """Monitor for new token launches"""
        event_filter = self.event_hub.events.TokenLaunched.createFilter(fromBlock='latest')
        
        while True:
            for event in event_filter.get_new_entries():
                token_data = {
                    'address': event['args']['token'],
                    'name': event['args']['name'],
                    'symbol': event['args']['symbol'],
                    'creator': event['args']['creator'],
                    'bonding_curve': event['args']['bondingCurve'],
                    'timestamp': event['args']['timestamp']
                }
                
                await self.analyze_token(token_data)
            
            await asyncio.sleep(1)
    
    async def analyze_token(self, token_data):
        """Analyze token for trading opportunities"""
        # Implement your trading strategy here
        print(f"New token launched: {token_data['name']} ({token_data['symbol']})")
        
        # Example: Auto-buy small amount of promising tokens
        if self.should_buy(token_data):
            await self.buy_tokens(token_data['bonding_curve'], '0.1')  # 0.1 CORE
    
    def should_buy(self, token_data):
        """Implement your token analysis logic"""
        # Example criteria:
        # - Check creator's history
        # - Analyze token metadata
        # - Check social media presence
        return True  # Placeholder
    
    async def buy_tokens(self, bonding_curve_address, core_amount):
        """Buy tokens from bonding curve"""
        bonding_curve = self.w3.eth.contract(
            address=bonding_curve_address,
            abi=self.bonding_curve_abi
        )
        
        tx = bonding_curve.functions.buyTokens().buildTransaction({
            'from': self.account.address,
            'value': self.w3.toWei(core_amount, 'ether'),
            'gas': 200000,
            'gasPrice': self.w3.toWei('20', 'gwei'),
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.account.privateKey)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        print(f"Buy transaction sent: {tx_hash.hex()}")

# Usage
bot = CorePumpBot('https://rpc.coredao.org', 'your_private_key')
asyncio.run(bot.monitor_new_tokens())
```

### **Analytics API Integration**

```javascript
// Node.js analytics service
const express = require('express');
const { GraphQLClient } = require('graphql-request');

const app = express();
const graphqlClient = new GraphQLClient('https://api.thegraph.com/subgraphs/name/your-subgraph');

// Get platform statistics
app.get('/api/stats', async (req, res) => {
  const query = `
    query {
      platform(id: "platform") {
        totalTokens
        totalVolume
        totalFees
        totalUsers
      }
    }
  `;
  
  try {
    const data = await graphqlClient.request(query);
    res.json(data.platform);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trending tokens
app.get('/api/trending', async (req, res) => {
  const query = `
    query {
      tokens(
        first: 10
        orderBy: totalVolume
        orderDirection: desc
        where: { isGraduated: false }
      ) {
        id
        name
        symbol
        totalVolume
        totalTrades
        currentPrice
        createdAt
      }
    }
  `;
  
  try {
    const data = await graphqlClient.request(query);
    res.json(data.tokens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get token details with trading history
app.get('/api/token/:address', async (req, res) => {
  const { address } = req.params;
  
  const query = `
    query GetToken($id: ID!) {
      token(id: $id) {
        id
        name
        symbol
        creator { address }
        totalVolume
        totalTrades
        currentPrice
        isGraduated
        trades(first: 50, orderBy: timestamp, orderDirection: desc) {
          trader { address }
          isBuy
          coreAmount
          tokenAmount
          price
          timestamp
        }
      }
    }
  `;
  
  try {
    const data = await graphqlClient.request(query, { id: address.toLowerCase() });
    res.json(data.token);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Analytics API running on port 3000');
});
```

---

## 🔐 Security & Best Practices

### **Authorization Patterns**

```typescript
// Check if contract is authorized before integration
const isAuthorized = await eventHub.authorizedContracts(contractAddress);
if (!isAuthorized) {
  throw new Error('Contract not authorized to emit events');
}

// For contract integrations, ensure proper authorization
await eventHub.connect(owner).authorizeContract(newContractAddress, true);
```

### **Input Validation**

```typescript
// Always validate inputs before contract calls
const validateTokenCreation = (tokenData) => {
  if (!tokenData.name || tokenData.name.length === 0) {
    throw new Error('Token name cannot be empty');
  }
  if (!tokenData.symbol || tokenData.symbol.length === 0) {
    throw new Error('Token symbol cannot be empty');
  }
  if (tokenData.symbol.length > 10) {
    throw new Error('Token symbol too long');
  }
  // Add more validations as needed
};
```

### **Error Handling Patterns**

```typescript
// Comprehensive error handling
const handleContractError = (error) => {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    return 'Insufficient CORE balance for transaction';
  }
  if (error.message.includes('Purchase exceeds 4% limit')) {
    return 'Purchase amount exceeds 4% limit per wallet';
  }
  if (error.message.includes('Insufficient creation fee')) {
    return 'Please send exactly 1 CORE as creation fee';
  }
  return `Transaction failed: ${error.message}`;
};
```

### **Rate Limiting**

```typescript
// Implement rate limiting for API endpoints
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', apiLimiter);
```

### **Gas Optimization**

```typescript
// Optimize gas usage
const estimateGas = async (contractFunction, params) => {
  try {
    const gasEstimate = await contractFunction.estimateGas(...params);
    return gasEstimate.mul(120).div(100); // Add 20% buffer
  } catch (error) {
    console.warn('Gas estimation failed, using default');
    return 200000; // Default gas limit
  }
};

// Use gas estimation in transactions
const gasLimit = await estimateGas(coinFactory.createCoin, [
  name, symbol, description, image, website, telegram, twitter
]);

const tx = await coinFactory.createCoin(
  name, symbol, description, image, website, telegram, twitter,
  { value: ethers.utils.parseEther("1"), gasLimit }
);
```

---

## 📝 Code Examples

### **Complete Token Launch Flow**

```typescript
// Complete token launch and trading example
class TokenLauncher {
  constructor(private coinFactory: CoinFactory, private eventHub: EventHub) {}

  async launchToken(tokenData: TokenData): Promise<LaunchResult> {
    try {
      // 1. Validate input
      this.validateTokenData(tokenData);

      // 2. Create token
      const tx = await this.coinFactory.createCoin(
        tokenData.name,
        tokenData.symbol,
        tokenData.description,
        tokenData.image,
        tokenData.website,
        tokenData.telegram,
        tokenData.twitter,
        { value: ethers.utils.parseEther("1") }
      );

      // 3. Wait for confirmation
      const receipt = await tx.wait();

      // 4. Extract token address from events
      const event = receipt.events?.find(e => e.event === 'CoinCreated');
      const tokenAddress = event?.args?.coin;
      const bondingCurveAddress = event?.args?.bondingCurve;

      // 5. Listen for EventHub confirmation
      const tokenLaunchedEvent = await this.waitForEventHubEvent(
        'TokenLaunched',
        tokenAddress
      );

      return {
        success: true,
        tokenAddress,
        bondingCurveAddress,
        txHash: receipt.transactionHash,
        eventHubConfirmed: true
      };

    } catch (error) {
      return {
        success: false,
        error: this.handleError(error)
      };
    }
  }

  private async waitForEventHubEvent(eventType: string, tokenAddress: string): Promise<boolean> {
    return new Promise((resolve) => {
      const filter = this.eventHub.filters[eventType](tokenAddress);
      
      const timeout = setTimeout(() => {
        this.eventHub.off(filter);
        resolve(false);
      }, 30000); // 30 second timeout

      this.eventHub.once(filter, () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  }
}
```

### **Real-time Dashboard Component**

```tsx
// React component for real-time platform dashboard
import React, { useState, useEffect } from 'react';
import { useEventHub } from './hooks/useEventHub';
import { useSubgraphData } from './hooks/useSubgraphData';

const PlatformDashboard: React.FC = () => {
  const { events } = useEventHub();
  const { platformStats, tokens, loading } = useSubgraphData();
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    // Update recent activity from EventHub events
    const newActivity = events.slice(-10).map(event => ({
      id: `${event.type}-${Date.now()}`,
      type: event.type,
      timestamp: event.timestamp,
      data: event
    }));
    setRecentActivity(newActivity);
  }, [events]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <StatCard 
          title="Total Tokens" 
          value={platformStats?.totalTokens || 0} 
        />
        <StatCard 
          title="Total Volume" 
          value={`${platformStats?.totalVolume || 0} CORE`} 
        />
        <StatCard 
          title="Total Fees" 
          value={`${platformStats?.totalFees || 0} CORE`} 
        />
        <StatCard 
          title="Active Users" 
          value={platformStats?.totalUsers || 0} 
        />
      </div>

      <div className="dashboard-content">
        <div className="recent-tokens">
          <h3>Recent Token Launches</h3>
          {tokens.slice(0, 5).map(token => (
            <TokenCard key={token.id} token={token} />
          ))}
        </div>

        <div className="live-activity">
          <h3>Live Activity</h3>
          {recentActivity.map(activity => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
  <div className="stat-card">
    <h4>{title}</h4>
    <p className="stat-value">{value}</p>
  </div>
);

const TokenCard: React.FC<{ token: any }> = ({ token }) => (
  <div className="token-card">
    <div className="token-info">
      <h4>{token.name} ({token.symbol})</h4>
      <p>Volume: {token.totalVolume} CORE</p>
      <p>Price: {token.currentPrice} CORE</p>
    </div>
    <div className="token-status">
      {token.isGraduated ? (
        <span className="graduated">Graduated</span>
      ) : (
        <span className="trading">Trading</span>
      )}
    </div>
  </div>
);
```

### **Multi-step Trading Integration**

```typescript
// Complete trading flow with error handling and confirmations
class TradingManager {
  constructor(
    private provider: ethers.providers.Provider,
    private signer: ethers.Signer
  ) {}

  async executeTrade(params: TradeParams): Promise<TradeResult> {
    const { tokenAddress, bondingCurveAddress, action, amount } = params;

    try {
      // Step 1: Get contracts
      const bondingCurve = BondingCurve__factory.connect(bondingCurveAddress, this.signer);
      const token = Coin__factory.connect(tokenAddress, this.signer);

      // Step 2: Pre-trade validations
      await this.validateTrade(bondingCurve, token, action, amount);

      // Step 3: Execute trade based on action
      let tx: ethers.ContractTransaction;
      
      if (action === 'buy') {
        tx = await this.executeBuy(bondingCurve, amount);
      } else {
        tx = await this.executeSell(bondingCurve, token, amount);
      }

      // Step 4: Wait for confirmation
      const receipt = await tx.wait();

      // Step 5: Parse results
      const tradeEvent = receipt.events?.find(e => 
        e.event === 'TokenPurchased' || e.event === 'TokenSold'
      );

      return {
        success: true,
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        tokenAmount: tradeEvent?.args?.tokenAmount?.toString(),
        coreAmount: tradeEvent?.args?.coreAmount?.toString(),
        newPrice: tradeEvent?.args?.newPrice?.toString()
      };

    } catch (error) {
      return {
        success: false,
        error: this.parseTradeError(error)
      };
    }
  }

  private async validateTrade(
    bondingCurve: BondingCurve,
    token: Coin,
    action: 'buy' | 'sell',
    amount: string
  ): Promise<void> {
    const userAddress = await this.signer.getAddress();

    if (action === 'buy') {
      // Check CORE balance
      const balance = await this.provider.getBalance(userAddress);
      const requiredAmount = ethers.utils.parseEther(amount);
      
      if (balance.lt(requiredAmount)) {
        throw new Error('Insufficient CORE balance');
      }

      // Check 4% purchase limit
      const currentHoldings = await bondingCurve.purchaseAmounts(userAddress);
      const totalSupply = ethers.utils.parseEther('1000000000'); // 1B tokens
      const fourPercentLimit = totalSupply.mul(4).div(100);
      
      // Estimate tokens to be received
      const estimatedTokens = await this.estimateTokensReceived(bondingCurve, amount);
      
      if (currentHoldings.add(estimatedTokens).gt(fourPercentLimit)) {
        throw new Error('Purchase would exceed 4% limit');
      }

    } else {
      // Check token balance
      const tokenBalance = await token.balanceOf(userAddress);
      const sellAmount = ethers.utils.parseEther(amount);
      
      if (tokenBalance.lt(sellAmount)) {
        throw new Error('Insufficient token balance');
      }

      // Check allowance
      const allowance = await token.allowance(userAddress, bondingCurve.address);
      if (allowance.lt(sellAmount)) {
        throw new Error('Insufficient token allowance');
      }
    }
  }

  private async executeBuy(bondingCurve: BondingCurve, coreAmount: string): Promise<ethers.ContractTransaction> {
    const value = ethers.utils.parseEther(coreAmount);
    const gasLimit = await bondingCurve.estimateGas.buyTokens({ value });
    
    return bondingCurve.buyTokens({
      value,
      gasLimit: gasLimit.mul(120).div(100) // 20% buffer
    });
  }

  private async executeSell(
    bondingCurve: BondingCurve,
    token: Coin,
    tokenAmount: string
  ): Promise<ethers.ContractTransaction> {
    const amount = ethers.utils.parseEther(tokenAmount);
    
    // First approve if needed
    const userAddress = await this.signer.getAddress();
    const allowance = await token.allowance(userAddress, bondingCurve.address);
    
    if (allowance.lt(amount)) {
      const approveTx = await token.approve(bondingCurve.address, amount);
      await approveTx.wait();
    }

    // Then sell
    const gasLimit = await bondingCurve.estimateGas.sellTokens(amount);
    return bondingCurve.sellTokens(amount, {
      gasLimit: gasLimit.mul(120).div(100)
    });
  }

  private async estimateTokensReceived(bondingCurve: BondingCurve, coreAmount: string): Promise<ethers.BigNumber> {
    // This would require a view function on the bonding curve
    // For now, we'll use a simplified estimation
    const currentPrice = await bondingCurve.getCurrentPrice();
    const coreAmountBN = ethers.utils.parseEther(coreAmount);
    return coreAmountBN.mul(ethers.utils.parseEther('1')).div(currentPrice);
  }

  private parseTradeError(error: any): string {
    if (error.message.includes('Purchase exceeds 4% limit')) {
      return 'Purchase amount exceeds the 4% wallet limit';
    }
    if (error.message.includes('Insufficient')) {
      return error.message;
    }
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return 'Insufficient funds for transaction';
    }
    return `Trade failed: ${error.message}`;
  }
}
```

---

## 🧪 Testing & Deployment

### **Local Development Setup**

```bash
# Clone and setup
git clone https://github.com/your-org/corepump-contracts.git
cd corepump-contracts

# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npm test

# Run specific test suites
npx hardhat test test/EventHub.test.ts
npx hardhat test test/EventHubIntegration.test.ts

# Start local node
npx hardhat node

# Deploy to local network
npx hardhat run scripts/deploy.ts --network localhost
```

### **Testing Integration**

```typescript
// integration-test.ts - Test your integration
import { ethers } from 'hardhat';
import { expect } from 'chai';

describe('Integration Tests', function () {
  let coinFactory: any;
  let eventHub: any;
  let signer: any;

  beforeEach(async function () {
    [signer] = await ethers.getSigners();
    
    // Deploy contracts (use your deployment script)
    const deployment = await deployContracts();
    coinFactory = deployment.coinFactory;
    eventHub = deployment.eventHub;
  });

  it('Should complete full token lifecycle', async function () {
    // 1. Create token
    const tx = await coinFactory.createCoin(
      'Test Token',
      'TEST',
      'A test token',
      '',
      '',
      '',
      '',
      { value: ethers.utils.parseEther('1') }
    );

    const receipt = await tx.wait();
    const event = receipt.events?.find(e => e.event === 'CoinCreated');
    const tokenAddress = event?.args?.coin;
    const bondingCurveAddress = event?.args?.bondingCurve;

    // 2. Verify EventHub received the event
    const eventHubEvents = await eventHub.queryFilter(
      eventHub.filters.TokenLaunched()
    );
    expect(eventHubEvents.length).to.be.greaterThan(0);

    // 3. Test trading
    const bondingCurve = await ethers.getContractAt('BondingCurve', bondingCurveAddress);
    await bondingCurve.buyTokens({ value: ethers.utils.parseEther('10') });

    // 4. Verify trading events
    const tradingEvents = await eventHub.queryFilter(
      eventHub.filters.TokenTraded()
    );
    expect(tradingEvents.length).to.be.greaterThan(0);
  });
});
```

### **Deployment Checklist**

```typescript
// deployment-checklist.ts
export const deploymentChecklist = {
  preDeployment: [
    'Compile all contracts successfully',
    'Run full test suite (54 tests passing)',
    'Verify contract sizes are under limit',
    'Check gas costs are reasonable',
    'Audit smart contracts',
    'Test on testnet thoroughly'
  ],
  
  deployment: [
    'Deploy PlatformTreasury',
    'Deploy EventHub',
    'Deploy BondingCurve implementation',
    'Deploy Coin implementation',
    'Deploy CoinFactory with all addresses',
    'Authorize CoinFactory in PlatformTreasury',
    'Authorize CoinFactory in EventHub',
    'Verify all contracts on block explorer'
  ],
  
  postDeployment: [
    'Test token creation on mainnet',
    'Test trading functionality',
    'Verify EventHub events are emitted',
    'Deploy subgraph',
    'Update frontend with contract addresses',
    'Monitor for any issues'
  ]
};
```

### **Monitoring & Alerts**

```typescript
// monitoring.ts - Production monitoring
class PlatformMonitor {
  constructor(private eventHub: EventHub, private alertService: AlertService) {}

  async startMonitoring() {
    // Monitor for unusual activity
    this.eventHub.on('TokenLaunched', this.handleTokenLaunch.bind(this));
    this.eventHub.on('TokenTraded', this.handleTokenTrade.bind(this));
    this.eventHub.on('LargePurchaseAttempted', this.handleLargePurchase.bind(this));

    // Health checks
    setInterval(this.performHealthCheck.bind(this), 60000); // Every minute
  }

  private async handleTokenLaunch(event: any) {
    // Alert on suspicious token launches
    if (await this.isSpamToken(event)) {
      await this.alertService.send('Potential spam token detected', event);
    }
  }

  private async handleLargePurchase(event: any) {
    // Alert on 4% limit violations
    await this.alertService.send('4% purchase limit violation', {
      token: event.token,
      buyer: event.buyer,
      attemptedAmount: ethers.utils.formatEther(event.attemptedAmount)
    });
  }

  private async performHealthCheck() {
    try {
      // Check if EventHub is responding
      const blockNumber = await this.eventHub.provider.getBlockNumber();
      
      // Check recent activity
      const recentEvents = await this.eventHub.queryFilter(
        this.eventHub.filters.TokenLaunched(),
        blockNumber - 100
      );

      // Alert if no activity for too long
      if (recentEvents.length === 0) {
        await this.alertService.send('No token launches in last 100 blocks');
      }

    } catch (error) {
      await this.alertService.send('Health check failed', error);
    }
  }
}
```

---

## 🔧 Troubleshooting

### **Common Issues & Solutions**

#### **1. Transaction Failures**

```typescript
// Common transaction error handling
const handleTransactionError = (error: any) => {
  const errorMap = {
    'insufficient funds': 'Not enough CORE in wallet',
    'gas required exceeds allowance': 'Gas limit too low, try increasing',
    'Purchase exceeds 4% limit': 'Cannot buy more than 4% of total supply',
    'Name cannot be empty': 'Token name is required',
    'Symbol too long': 'Token symbol must be 10 characters or less',
    'Insufficient creation fee': 'Must send exactly 1 CORE as creation fee',
    'execution reverted': 'Transaction failed - check parameters'
  };

  for (const [key, message] of Object.entries(errorMap)) {
    if (error.message.toLowerCase().includes(key)) {
      return message;
    }
  }

  return `Transaction failed: ${error.message}`;
};
```

#### **2. EventHub Integration Issues**

```typescript
// Debug EventHub connection
const debugEventHub = async (eventHub: EventHub) => {
  try {
    // Check if contract is deployed
    const code = await eventHub.provider.getCode(eventHub.address);
    if (code === '0x') {
      throw new Error('EventHub contract not deployed at this address');
    }

    // Check if we can read from contract
    const owner = await eventHub.owner();
    console.log('EventHub owner:', owner);

    // Check authorization
    const isAuthorized = await eventHub.authorizedContracts(coinFactoryAddress);
    console.log('CoinFactory authorized:', isAuthorized);

    // Test event filtering
    const filter = eventHub.filters.TokenLaunched();
    const events = await eventHub.queryFilter(filter, -100);
    console.log('Recent TokenLaunched events:', events.length);

  } catch (error) {
    console.error('EventHub debug failed:', error);
  }
};
```

#### **3. Subgraph Sync Issues**

```bash
# Subgraph troubleshooting commands

# Check subgraph status
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ indexingStatusForCurrentVersion(subgraphName: \"your-subgraph\") { synced health fatalError { message } } }"}' \
  https://api.thegraph.com/index-node/graphql

# Redeploy subgraph
graph deploy --product hosted-service your-username/corepump-subgraph

# Check for indexing errors
graph logs --product hosted-service your-username/corepump-subgraph
```

#### **4. Gas Estimation Problems**

```typescript
// Robust gas estimation
const safeGasEstimate = async (contractFunction: any, params: any[]) => {
  try {
    // Try normal estimation
    const estimate = await contractFunction.estimateGas(...params);
    return estimate.mul(130).div(100); // 30% buffer
  } catch (error) {
    console.warn('Gas estimation failed:', error.message);
    
    // Fallback gas limits based on function
    const gasLimits = {
      'createCoin': 1500000,
      'buyTokens': 200000,
      'sellTokens': 150000,
      'authorize': 100000
    };
    
    const functionName = contractFunction.fragment.name;
    return gasLimits[functionName] || 200000;
  }
};
```

### **Performance Optimization**

```typescript
// Optimize contract calls
class OptimizedContractManager {
  private cache = new Map();
  private batchRequests: any[] = [];

  // Cache frequently accessed data
  async getCachedTokenData(tokenAddress: string) {
    const cacheKey = `token-${tokenAddress}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
        return cached.data;
      }
    }

    const token = Coin__factory.connect(tokenAddress, this.provider);
    const [name, symbol, totalSupply] = await Promise.all([
      token.name(),
      token.symbol(),
      token.totalSupply()
    ]);

    const data = { name, symbol, totalSupply };
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  // Batch multiple calls
  async batchCall(calls: any[]) {
    const multicall = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, this.provider);
    
    const callData = calls.map(call => ({
      target: call.contract.address,
      callData: call.contract.interface.encodeFunctionData(call.method, call.params)
    }));

    const results = await multicall.aggregate(callData);
    
    return results.returnData.map((data: string, index: number) => {
      const call = calls[index];
      return call.contract.interface.decodeFunctionResult(call.method, data);
    });
  }
}
```

### **Debug Tools**

```typescript
// Comprehensive debugging utilities
export const debugUtils = {
  // Log transaction details
  logTransaction: async (txHash: string, provider: ethers.providers.Provider) => {
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    console.log('Transaction Details:', {
      hash: txHash,
      from: tx.from,
      to: tx.to,
      value: ethers.utils.formatEther(tx.value),
      gasLimit: tx.gasLimit.toString(),
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: ethers.utils.formatUnits(tx.gasPrice!, 'gwei'),
      status: receipt.status === 1 ? 'Success' : 'Failed',
      events: receipt.events?.map(e => e.event)
    });
  },

  // Decode contract events
  decodeEvents: (receipt: ethers.ContractReceipt, contract: ethers.Contract) => {
    return receipt.events?.map(event => {
      try {
        return contract.interface.parseLog(event);
      } catch {
        return { event: 'Unknown', args: [] };
      }
    });
  },

  // Check contract state
  checkContractState: async (address: string, provider: ethers.providers.Provider) => {
    const code = await provider.getCode(address);
    const balance = await provider.getBalance(address);
    
    return {
      isContract: code !== '0x',
      codeSize: code.length,
      balance: ethers.utils.formatEther(balance)
    };
  }
};
```

---

## 📚 Additional Resources

### **Official Links**
- **GitHub Repository**: https://github.com/your-org/corepump-contracts
- **Documentation**: https://docs.corepump.meme
- **Subgraph**: https://thegraph.com/hosted-service/subgraph/your-org/corepump
- **Block Explorer**: https://scan.coredao.org

### **Community & Support**
- **Discord**: https://discord.gg/corepump
- **Telegram**: https://t.me/corepump
- **Twitter**: https://twitter.com/corepump

### **Development Tools**
- **Hardhat**: https://hardhat.org
- **The Graph**: https://thegraph.com
- **Core Chain RPC**: https://rpc.coredao.org
- **Core Chain Docs**: https://docs.coredao.org

### **Security Resources**
- **OpenZeppelin**: https://openzeppelin.com/contracts
- **Slither**: https://github.com/crytic/slither
- **MythX**: https://mythx.io

---

## 🎉 Conclusion

The CorePump platform provides a robust, secure, and scalable foundation for token launches on Core Chain. With the EventHub system, you get:

- **🎯 Unified Analytics**: Single source of truth for all platform events
- **⚡ Real-time Data**: Live updates through WebSocket connections
- **🔄 Easy Integration**: Comprehensive APIs and SDKs
- **🛡️ Production Ready**: Battle-tested with 54 passing tests
- **📊 Rich Ecosystem**: Subgraphs, bots, and third-party tools

Whether you're building a frontend, analytics dashboard, trading bot, or integrating with existing DeFi protocols, this guide provides everything you need to get started.

**Happy building! 🚀**

---

*Last updated: July 15, 2025*
*Version: 1.0.0*
