### **Project Rulebook: The "True Stability" Protocol V3**

**Preamble:** This document outlines the immutable business rules governing the CorePump.meme platform with dynamic supply stability mechanisms. These rules are designed to maximize fairness, security, long-term sustainability, and price stability for all participants. All rules are to be enforced programmatically by the platform's smart contracts wherever technically feasible.

---

### **Section 1: Platform-Wide Rules**

* **Rule 1.1: Blockchain Mandate:** All operations shall be conducted exclusively on the **Core Chain** blockchain.

* **Rule 1.2: Progressive Decentralization Model:** All `Coin` contracts launched on the platform shall follow a progressive decentralization timeline:
  - **Phase 1 (0-90 days):** Multisig control for critical bug fixes and stability parameter tuning
  - **Phase 2 (90-365 days):** DAO governance with 48-hour timelock for all contract changes  
  - **Phase 3 (365+ days):** Immutable core contracts, governance limited to parameters within preset bounds

* **Rule 1.3: The "True Stability" Standard:** The platform will officially recognize and promote tokens that adhere to dynamic supply stability mechanisms, maintaining price stability through algorithmic minting and burning reactions to market demand.

---

### **Section 2: Token Lifecycle Rules**

These rules govern a token's journey from inception to maturity with stability mechanisms.

#### **2.1 Creation Phase**

* **Rule 2.1.1: Creation Fee:** A non-refundable fee of **1 CORE** shall be levied to launch a new token, allocated to the Platform Treasury.

* **Rule 2.1.2: Dynamic Supply Model:** Every token launched shall have:
  - **Base supply:** 1,000,000,000 tokens at creation
  - **Maximum supply cap:** 10,000,000,000 tokens (10x expansion limit)
  - **Minimum supply floor:** 100,000,000 tokens (10x contraction limit)
  - **Dynamic adjustment:** Supply responds to market conditions to maintain price stability within algorithmic parameters

* **Rule 2.1.3: Creator Allocation:** The Creator's **5%** allocation of the base supply is automatically sent to the **Milestone-Based Vesting** contract upon creation.

#### **2.2 Bonding Curve Phase**

* **Rule 2.2.1: Platform Trading Fee:** A **1% fee**, payable in `CORE`, shall be applied to every transaction on the bonding curve, directed to the Platform Treasury.

* **Rule 2.2.2: Anti-Concentration Limits:** 
  - **4%** maximum purchase per wallet during bonding curve phase
  - Additional wallets from same entity limited to combined **8%** (subject to KYC verification)
  - **Purchase limits tightened during high volatility** to prevent manipulation

#### **2.3 The Graduation Event**

* **Rule 2.3.1: Graduation Threshold:** Graduation is automatically triggered when a token's market capitalization (total `CORE` raised) reaches the equivalent of **$50,000 USD**.

* **Rule 2.3.2: Automated Liquidity & Stability Provision:** Upon graduation, **70%** of the `CORE` held in the bonding curve contract shall be distributed as follows:
  - **60%** → Paired with corresponding tokens and deposited as DEX liquidity
  - **10%** → Token Stability Pool for price stabilization mechanisms

* **Rule 2.3.3: The Golden Rule - Mandatory LP Burn:** **100% of the Liquidity Provider (LP) tokens** received from the DEX shall be programmatically and immediately sent to a burn address.

* **Rule 2.3.4: Creator & Treasury Allocation:** The remaining **30%** of the `CORE` from the bonding curve shall be distributed: **10%** to the Creator's wallet and **20%** to the Platform Treasury.

#### **2.4 Post-Graduation Phase**

* **Rule 2.4.1: Significant Holder Vesting:** At the moment of DEX graduation, any wallet holding more than **1% of the total token supply** will be automatically designated an "Early Whale." The entirety of that wallet's holdings will be placed into the **Stability-Enhanced Vesting** contract.

* **Rule 2.4.2: Stability-Enhanced Vesting:** The vesting contract releases tokens in three tranches only when the following stability milestones are met:
  - **Tranche 1 (25% release):** Token maintains **<20% volatility** for 30 consecutive days
  - **Tranche 2 (25% release):** Token achieves **1,000 unique holders** + successful execution of at least one stability action
  - **Tranche 3 (50% release):** Token achieves **$1,000,000 in cumulative trading volume** + 90-day stability performance score **>80%**

* **Rule 2.4.3: Enhanced Whale Wallet Management:** Graduated token whale protection system:
  - **Wallets >2% supply:** 0.5% daily sell limit + 24-hour cooldown if exceeded
  - **Wallets >5% supply:** Additional vesting requirements + governance participation restrictions
  - **Wallets >10% supply:** Mandatory stability pool contribution + enhanced transparency requirements
  - **Stability rewards:** Large holders who support price stability receive governance token incentives

---

### **Section 3: Dynamic Supply & Stability Mechanisms**

#### **3.1 Supply Expansion Conditions**

Tokens may mint additional supply when **ALL** conditions are met:
* Price sustains **>10% above 7-day moving average** for **168+ hours** (7 consecutive days)
* Daily trading volume exceeds **$10,000 USD equivalent**
* No single wallet controls **>15% of circulating supply**
* **Maximum expansion:** 2% of current supply per 30-day period
* **New token distribution:** 70% to stability pool, 20% to existing holders pro-rata, 10% burned immediately

#### **3.2 Supply Contraction Conditions**

Tokens may burn existing supply when **ALL** conditions are met:
* Price trades **>10% below 7-day moving average** for **168+ hours** (7 consecutive days)
* DEX liquidity depth exceeds **$50,000 USD equivalent**
* Platform treasury can fund minimum **1% of supply buyback**
* **Maximum contraction:** 2% of current supply per 30-day period
* **Buyback priority:** Open market purchase → immediate burn

#### **3.3 Stability Pool Operations**

Each graduated token maintains a **Stability Pool** funded by:
* **10%** of graduation liquidity allocation
* **50%** of expansion mint proceeds
* Voluntary community contributions with **25% platform matching**

**Pool Usage Authorization:**
* **Automatic:** Price stabilization within approved parameters
* **Governance:** Emergency market support (requires token holder vote with >15% quorum)
* **Prohibited:** Direct transfers to individuals, speculative trading

#### **3.4 Price Oracle & Manipulation Protection**

All stability actions require:
* Minimum **3 independent price sources** with **<5% deviation**
* **Volume-weighted price calculation** over 24-hour minimum
* **Anti-manipulation checks:** Unusual volume patterns trigger 24-hour cooling period
* **Circuit breakers:** No stability actions during platform-wide volatility events

---

### **Section 4: Enhanced Governance Framework**

#### **4.1 Token-Level Stability Governance**

Holders of graduated tokens may vote on:
* **Stability thresholds** (within 5%-25% deviation range)
* **Action timeframes** (3-14 day windows)
* **Stability pool allocation** priorities
* **Emergency stability interventions**

**Voting Mechanics:**
* **Voting Power:** Token balance × (holding duration in days ÷ 365) × stability participation bonus
* **Quorum:** 15% of circulating supply must participate
* **Timelock:** 48 hours for parameter changes, 7 days for pool usage decisions

#### **4.2 Platform-Level Governance**

Platform token (**$PUMP**) holders vote on:
* **Global stability parameters** and system limits
* **Token graduation requirements** and threshold adjustments
* **Platform fee structure** and revenue distribution
* **Emergency platform-wide** circuit breakers

**Voting Mechanics:**
* **Voting Power:** $PUMP balance × creator reputation score × governance participation history
* **Quorum:** 25% of $PUMP supply must participate
* **Timelock:** 72 hours for protocol changes, 14 days for economic model changes

#### **4.3 Cross-Token Stability Governance**

For system-wide stability events affecting multiple tokens:
* **Emergency council** of top 5 performing token communities
* Platform governance can authorize **cross-token stability actions**
* Affected tokens **share costs proportionally** based on benefit received

---

### **Section 5: Platform Token Economics ($PUMP)**

#### **5.1 Token Distribution & Utility**

**$PUMP Total Supply:** 1,000,000,000 tokens (fixed supply)

**Distribution:**
* **40%** → Graduated token creators (vested based on token performance metrics)
* **25%** → Community treasury for ecosystem incentives and development
* **20%** → Early platform users (retroactive airdrop based on platform activity)
* **10%** → Team/development (4-year vest with 1-year cliff)
* **5%** → Strategic partnerships and protocol integrations

**Utility Functions:**
* **Governance voting power** for all platform-level decisions
* **Fee discounts:** 25% reduction on trading fees for active stakers
* **Revenue sharing:** 50% of platform fees distributed to stakers quarterly
* **Priority access:** New features, analytics tools, and premium services

#### **5.2 Value Accrual Mechanisms**

**Platform Revenue Allocation:**
* **30%** → $PUMP buyback and burn (deflationary pressure)
* **25%** → Stability pools across all graduated tokens
* **25%** → Platform development and operational expenses
* **20%** → Community rewards and creator incentive programs

**Burn Schedule:** Quarterly buyback using platform revenues, burned tokens reduce total supply permanently

---

### **Section 6: Enhanced Fee & Revenue Structure**

| Fee Type | Amount | Trigger | Destination | Purpose |
|----------|--------|---------|-------------|---------|
| **Creation Fee** | 1 CORE | Token Launch | Platform Treasury | Platform Operations |
| **Bonding Curve Fee** | 1% of transaction value | Buy/Sell on Curve | Platform Treasury | Revenue Generation |
| **Stability Action Fee** | 0.5% of action value | Supply Adjustment | Token Stability Pool | Stability Maintenance |
| **Graduation Bonus** | 10% of raised CORE | Graduation Event | Creator's Wallet | Creator Incentive |
| **Stability Pool Allocation** | 10% of raised CORE | Graduation Event | Token Stability Pool | Price Stabilization |
| **Governance Fee** | 0.1% of transaction value | Any Token Trade | $PUMP Stakers | Governance Participation |
| **Premium Features Fee** | Variable Pricing | Analytics/Tools Access | Platform Development | Feature Development |

---

### **Section 7: Security & Risk Management**

#### **7.1 Anti-Manipulation Safeguards**

* **Oracle Protection:** Minimum 3 independent price feeds with deviation monitoring
* **Volume Validation:** Minimum volume thresholds for all stability actions
* **Time Delays:** Mandatory waiting periods between consecutive stability actions
* **Circuit Breakers:** Automatic pause during detected manipulation attempts

#### **7.2 Emergency Procedures**

* **Emergency Pause:** Platform-wide trading halt capability for critical security issues
* **Stability Override:** Manual intervention authority for stability system failures
* **Fund Recovery:** Procedures for recovering funds from compromised contracts
* **Community Communication:** Transparent reporting requirements for all emergency actions

#### **7.3 Upgrade & Migration Safeguards**

* **Timelock Requirements:** All contract upgrades subject to minimum 72-hour delay
* **Community Review:** Public disclosure of all upgrade proposals with technical documentation
* **Rollback Capability:** Ability to revert upgrades within 30 days if critical issues discovered
* **Migration Protection:** User funds remain accessible during any upgrade process

---

### **Section 8: Performance & Success Metrics**

#### **8.1 Stability Performance Indicators**

* **Volatility Reduction:** Target 50% lower price volatility vs. comparable non-stable tokens
* **Stability Action Accuracy:** >80% of actions achieve intended price stabilization effect
* **Holder Retention:** Target 80% holder retention rate post-graduation vs. 20% industry standard
* **Equilibrium Time:** Average time to reach price stability after major market events

#### **8.2 Platform Health Metrics**

* **Total Value Locked (TVL):** Cumulative value across all stability pools and DEX liquidity
* **Active Governance Participation:** Percentage of eligible voters participating in governance
* **Creator Success Rate:** Percentage of tokens successfully graduating and maintaining stability
* **Community Satisfaction:** Regular surveys and feedback mechanisms for continuous improvement

#### **8.3 Economic Sustainability Metrics**

* **Revenue Diversification:** Tracking revenue sources to ensure platform sustainability
* **Stability Pool Health:** Monitoring pool balances and utilization across all tokens
* **Platform Token Adoption:** $PUMP distribution, staking rates, and utility usage
* **Cross-Token Network Effects:** Measuring positive interactions between different token communities

---

### **Conclusion**

This rulebook establishes CorePump as the first truly stable meme token platform, delivering on the promise of "minting/burning features reacting to market demand to maintain price stability." Through dynamic supply mechanisms, comprehensive governance, and robust anti-manipulation safeguards, the platform creates sustainable token ecosystems that benefit creators, holders, and the broader community.

These rules are designed to evolve with the platform while maintaining core stability principles, ensuring long-term success and continued innovation in the decentralized token launch space.

---

**Document Version:** V3.0  
**Last Updated:** November 8, 2025  
**Status:** Implementation Ready - Requires Technical Development Phase
