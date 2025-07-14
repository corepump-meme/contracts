### **Project Rulebook: The "CorePump" Protocol**

**Preamble:** This document outlines the immutable business rules governing the token launchpad platform. These rules are designed to maximize fairness, security, and long-term sustainability for all participants. All rules are to be enforced programmatically by the platform's smart contracts wherever technically feasible.

---

### **Section 1: Platform-Wide Rules**

* **Rule 1.1: Blockchain Mandate:** All operations shall be conducted exclusively on the Core Chain blockchain.
* **Rule 1.2: Immutability Principle:** All `Coin` contracts launched on the platform shall have their ownership renounced or locked upon creation, rendering them immutable and free from creator manipulation. The minting function shall be permanently disabled post-creation.
* **Rule 1.3: The "Certified Stable" Standard:** The platform will officially recognize and promote tokens that adhere to the highest standards of stability (adopting all optional rules like the Stability Tax). This certification is a core tenet of the platform's value proposition.

---

### **Section 2: Token Lifecycle Rules**

These rules govern a token's journey from inception to maturity.

#### **2.1 Creation Phase**

* **Rule 2.1.1: Creation Fee:** A non-refundable fee of **1 CORE** shall be levied to launch a new token. This fee is allocated to the Platform Treasury to fund operations and ecosystem growth.
* **Rule 2.1.2: Standardized Supply:** Every token launched shall have a fixed, non-inflationary total supply of **1,000,000,000** tokens.
* **Rule 2.1.3: Initial Token Allocation:** Upon creation, the total supply is allocated as follows:
    * **80%** to the Bonding Curve Contract for public sale.
    * **15%** reserved for the "Milestone-Based Vesting" contract for Early Buyers.
    * **5%** allocated to the Creator, also locked in the "Milestone-Based Vesting" contract.

#### **2.2 Bonding Curve Phase (Initial Trading)**

* **Rule 2.2.1: Platform Trading Fee:** A **1% fee**, payable in `CORE`, shall be applied to every buy and sell transaction on the bonding curve.
* **Rule 2.2.2: Bonding Curve Uniformity:** The mathematical formula for the bonding curve shall be identical for all tokens, ensuring a fair and predictable price trajectory for every launch.
* **Rule 2.2.3: Fee Allocation:** All fees collected during this phase shall be directed to the Platform Treasury.

#### **2.3 The Graduation Event**

* **Rule 2.3.1: Graduation Threshold:** Graduation is automatically triggered when a token's market capitalization (total `CORE` raised by the bonding curve) reaches the equivalent of **$50,000 USD**.
* **Rule 2.3.2: Automated Liquidity Provision:** Upon graduation, **70%** of the `CORE` held in the bonding curve contract shall be irrevocably paired with a corresponding portion of the remaining token supply and deposited as liquidity into a designated Core Chain DEX (e.g., ArcherSwap).
* **Rule 2.3.3: The Golden Rule - Mandatory LP Burn:** **100% of the Liquidity Provider (LP) tokens** received from the DEX shall be programmatically and immediately sent to a burn address. This rule is absolute and serves as the platform's primary anti-rug pull guarantee.
* **Rule 2.3.4: Creator & Treasury Allocation:** The remaining 30% of the `CORE` from the bonding curve shall be distributed: 10% to the Creator's wallet as a launch bonus and 20% to the Platform Treasury.

#### **2.4 Post-Graduation Phase (DEX Trading & Stability)**

* **Rule 2.4.1: The "Anti-Dump" Vesting Lock:** All Creator and Early Buyer tokens (20% of total supply) are subject to **Milestone-Based Vesting**. Tokens are released from the vesting contract to the holders' wallets only when the following conditions are met:
    * **Tranche 1 (25% release):** Token sustains a $250,000 market cap for 72 consecutive hours.
    * **Tranche 2 (25% release):** Token achieves 1,000 unique on-chain holders.
    * **Tranche 3 (50% release):** Token achieves $1,000,000 in cumulative trading volume on the DEX.
* **Rule 2.4.2: The Stability Tax:** All tokens launched on the platform shall carry a **1% tax** on every DEX buy and sell transaction.
* **Rule 2.4.3: The Token Treasury:** Revenue from the Stability Tax shall be automatically converted to `CORE` and deposited into a unique, dedicated **Treasury Contract** for that specific token. This treasury is explicitly for funding buyback-and-burn operations as determined by its community.

---

### **Section 3: Governance Rules**

* **Rule 3.1: Token-Level Governance:** Holders of a specific launched token shall have the right to vote on the deployment of funds from their token's unique Treasury Contract.
* **Rule 3.2: Platform-Level Governance:** Holders of the platform's native token (`$LAUNCH`, to be released in a future phase) shall have voting rights on all Platform-Wide Rules, including fee structures, graduation thresholds, and the use of the main Platform Treasury.
* **Rule 3.3: Creator Incentives:** Creators of projects that achieve the "Certified Stable" standard shall be eligible for rewards, such as a partial refund of their creation fee or a share of future platform revenue, as determined by platform governance.

---

### **Section 4: Fee & Revenue Structure Summary**

| Fee Type | Amount | Trigger | Destination |
| :--- | :--- | :--- | :--- |
| **Creation Fee** | 1 CORE | Token Launch | Platform Treasury |
| **Bonding Curve Fee** | 1% of transaction value | Buy/Sell on Curve | Platform Treasury |
| **Graduation Bonus** | 10% of raised `CORE` | Graduation Event | Creator's Wallet |
| **Graduation Treasury** | 20% of raised `CORE` | Graduation Event | Platform Treasury |
| **Stability Tax** | 1% of DEX trade value | Buy/Sell on DEX | Respective Token's Treasury |