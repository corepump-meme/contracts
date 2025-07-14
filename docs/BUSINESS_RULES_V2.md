### **Project Rulebook: The "Stable Launch" Protocol V6**

**Preamble:** This document outlines the immutable business rules governing the CorePump.meme platform. These rules are designed to maximize fairness, security, and long-term sustainability for all participants. All rules are to be enforced programmatically by the platform's smart contracts wherever technically feasible.

---

### **Section 1: Platform-Wide Rules**

* **Rule 1.1: Blockchain Mandate:** All operations shall be conducted exclusively on the **Core Chain** blockchain.
* **Rule 1.2: Immutability Principle:** All `Coin` contracts launched on the platform shall have their ownership renounced or locked upon creation. The minting function shall be permanently disabled post-creation, rendering the contract immune to manipulation.
* **Rule 1.3: The "Certified Stable" Standard:** The platform will officially recognize and promote tokens that adhere to the highest standards of stability. This certification is a core tenet of the platform's value proposition.

---

### **Section 2: Token Lifecycle Rules**

These rules govern a token's journey from inception to maturity.

#### **2.1 Creation Phase**

* **Rule 2.1.1: Creation Fee:** A non-refundable fee of **1 CORE** shall be levied to launch a new token, allocated to the Platform Treasury.
* **Rule 2.1.2: Standardized Supply:** Every token launched shall have a fixed, non-inflationary total supply of **1,000,000,000** tokens.
* **Rule 2.1.3: Creator Allocation:** The Creator's **5%** allocation of the total supply is automatically sent to the **Milestone-Based Vesting** contract upon creation.

#### **2.2 Bonding Curve Phase**

* **Rule 2.2.1: Platform Trading Fee:** A **1% fee**, payable in `CORE`, shall be applied to every transaction on the bonding curve, directed to the Platform Treasury.
* **Rule 2.2.2: Initial Buy Limit:** No single wallet address may purchase more than **4%** of the total token supply from the bonding curve. This ensures initial holder decentralization.

#### **2.3 The Graduation Event**

* **Rule 2.3.1: Graduation Threshold:** Graduation is automatically triggered when a token's market capitalization (total `CORE` raised) reaches the equivalent of **$50,000 USD**.
* **Rule 2.3.2: Automated Liquidity Provision:** Upon graduation, **70%** of the `CORE` held in the bonding curve contract shall be irrevocably paired with a corresponding portion of the token supply and deposited as liquidity into a designated Core Chain DEX.
* **Rule 2.3.3: The Golden Rule - Mandatory LP Burn:** **100% of the Liquidity Provider (LP) tokens** received from the DEX shall be programmatically and immediately sent to a burn address.
* **Rule 2.3.4: Creator & Treasury Allocation:** The remaining 30% of the `CORE` from the bonding curve shall be distributed: 10% to the Creator's wallet and 20% to the Platform Treasury.

#### **2.4 Post-Graduation Phase**

* **Rule 2.4.1: Significant Holder Vesting:** At the moment of DEX graduation, any wallet holding more than **1% of the total token supply** will be automatically designated an "Early Whale." The entirety of that wallet's holdings will be placed into the **Milestone-Based Vesting** contract.
* **Rule 2.4.2: Milestone-Based Vesting:** The vesting contract releases tokens in three tranches only when the following milestones are met:
    * **Tranche 1 (25% release):** Token sustains a $250,000 market cap for 72 consecutive hours.
    * **Tranche 2 (25% release):** Token achieves 1,000 unique on-chain holders.
    * **Tranche 3 (50% release):** Token achieves $1,000,000 in cumulative trading volume on the DEX.
* **Rule 2.4.3: Fair Sale Cooldown:** To protect market stability, a cooldown system applies to wallets holding more than **2% of the total supply** ("Whale Wallets").
    * **Daily Allowance:** Whale Wallets may sell up to **0.5%** of the total token supply within a 24-hour rolling period without penalty.
    * **Cooldown Trigger:** If a sale causes a Whale Wallet's total sales within the 24-hour period to exceed the 0.5% allowance, a **24-hour sales cooldown** will be immediately activated for that wallet.

---

### **Section 3: Governance**

* **Rule 3.1: Token-Level Governance:** Future development will allow token holders to vote on proposals related to their token's ecosystem.
* **Rule 3.2: Platform-Level Governance:** Holders of the platform's future native token shall have voting rights on all Platform-Wide Rules.

---

### **Section 4: Fee & Revenue Structure Summary**

| Fee Type | Amount | Trigger | Destination |
| :--- | :--- | :--- | :--- |
| **Creation Fee** | 1 CORE | Token Launch | Platform Treasury |
| **Bonding Curve Fee** | 1% of transaction value | Buy/Sell on Curve | Platform Treasury |
| **Graduation Bonus** | 10% of raised `CORE` | Graduation Event | Creator's Wallet |
| **Graduation Treasury**| 20% of raised `CORE` | Graduation Event | Platform Treasury |