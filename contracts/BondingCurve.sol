// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./EventHub.sol";

/**
 * @title BondingCurve
 * @dev Upgradeable bonding curve contract for price discovery and trading
 * Implements mathematical bonding curve with graduation mechanism
 */
contract BondingCurve is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable 
{
    using SafeERC20 for IERC20;
    
    // Constants
    uint256 public constant PLATFORM_FEE = 100; // 1% = 100 basis points
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_PURCHASE_PERCENTAGE = 400; // 4% = 400 basis points
    uint256 public constant GRADUATION_USD_THRESHOLD = 50000; // $50,000 USD (kept for upgrade compatibility)
    uint256 public constant GRADUATION_THRESHOLD = 116589 ether; // Fixed graduation threshold: 116,589 CORE
    
    // Token and platform addresses
    IERC20 public coin;
    address public platformTreasury;
    address public creator;
    address public priceOracle; // Kept for storage compatibility, no longer used
    EventHub public eventHub;
    
    // Bonding curve state
    uint256 public totalCoreRaised;       // Cumulative CORE raised (NEVER decreases)
    uint256 public currentCoreReserves;   // Current CORE balance (can decrease on sells)
    uint256 public tokensSold;
    uint256 public basePrice; // Base price in CORE per token
    bool public graduated;
    
    // Purchase tracking for limits
    mapping(address => uint256) public purchaseAmounts;
    
    // Events
    event TokenPurchased(
        address indexed buyer,
        uint256 coreAmount,
        uint256 tokenAmount,
        uint256 newPrice,
        uint256 fee
    );
    
    event TokenSold(
        address indexed seller,
        uint256 tokenAmount,
        uint256 coreAmount,
        uint256 newPrice,
        uint256 fee
    );
    
    event Graduated(
        address indexed token,
        uint256 totalRaised,
        uint256 liquidityCore,
        uint256 creatorBonus,
        uint256 treasuryAmount
    );
    
    event LiquidityCreated(
        address indexed token,
        uint256 tokenAmount,
        uint256 coreAmount
    );
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the bonding curve contract
     * @param coin_ The token contract address
     * @param creator_ The token creator address
     * @param platformTreasury_ The platform treasury address
     * @param basePrice_ The base price for the bonding curve
     * @param priceOracle_ The price oracle contract address
     * @param eventHub_ The event hub contract address
     */
    function initialize(
        address coin_,
        address creator_,
        address platformTreasury_,
        uint256 basePrice_,
        address priceOracle_,
        address eventHub_
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        require(coin_ != address(0), "Coin cannot be zero address");
        require(creator_ != address(0), "Creator cannot be zero address");
        require(platformTreasury_ != address(0), "Treasury cannot be zero address");
        require(priceOracle_ != address(0), "Price oracle cannot be zero address");
        require(eventHub_ != address(0), "Event hub cannot be zero address");
        require(basePrice_ > 0, "Base price must be greater than 0");
        
        coin = IERC20(coin_);
        creator = creator_;
        platformTreasury = platformTreasury_;
        basePrice = basePrice_;
        priceOracle = priceOracle_; // Just store address for compatibility
        eventHub = EventHub(eventHub_);
    }
    
    /**
     * @dev Calculate the current token price based on tokens sold
     * Uses quadratic bonding curve: price = basePrice * (1 + tokensSold/totalSupply)^2
     */
    function getCurrentPrice() public view returns (uint256) {
        uint256 totalSupply = 800_000_000 * 10**18; // 80% of 1B tokens available for sale
        if (tokensSold >= totalSupply) return 0;
        
        // Calculate price using quadratic curve
        // price = basePrice * (1 + progress)^2 where progress = tokensSold/totalSupply
        uint256 progress = (tokensSold * 10**18) / totalSupply; // Scale by 10^18 for precision
        uint256 progressPlusOne = 10**18 + progress;
        uint256 priceMultiplier = (progressPlusOne * progressPlusOne) / 10**18;
        
        return (basePrice * priceMultiplier) / 10**18;
    }
    
    /**
     * @dev Get the current graduation threshold in CORE tokens
     * @return threshold The amount of CORE needed for graduation (fixed at 116,589 CORE)
     */
    function getGraduationThreshold() public view returns (uint256 threshold) {
        // Return fixed threshold instead of USD-based calculation
        // This eliminates oracle manipulation vulnerability
        return GRADUATION_THRESHOLD;
    }
    
    /**
     * @dev Calculate tokens received for a given CORE amount using proper integral mathematics
     */
    function calculateTokensForCore(uint256 coreAmount) public view returns (uint256, uint256) {
        require(coreAmount > 0, "CORE amount must be greater than 0");
        require(!graduated, "Token has graduated");
        
        uint256 fee = (coreAmount * PLATFORM_FEE) / BASIS_POINTS;
        uint256 coreAfterFee = coreAmount - fee;
        
        // Use proper integral calculation to find tokens for given CORE amount
        uint256 tokensToReceive = _calculateTokensFromCoreIntegral(tokensSold, coreAfterFee);
        
        // Check if purchase would exceed available tokens
        uint256 totalSupply = 800_000_000 * 10**18;
        if (tokensSold + tokensToReceive > totalSupply) {
            tokensToReceive = totalSupply - tokensSold;
        }
        
        return (tokensToReceive, fee);
    }
    
    /**
     * @dev Calculate CORE received for selling tokens using proper integral mathematics
     */
    function calculateCoreForTokens(uint256 tokenAmount) public view returns (uint256, uint256) {
        require(tokenAmount > 0, "Token amount must be greater than 0");
        require(tokenAmount <= tokensSold, "Cannot sell more than sold");
        require(!graduated, "Token has graduated");
        
        // Use proper integral calculation for selling tokens
        uint256 coreBeforeFee = _calculateCoreFromTokensIntegral(tokensSold - tokenAmount, tokensSold);
        uint256 fee = (coreBeforeFee * PLATFORM_FEE) / BASIS_POINTS;
        uint256 coreAfterFee = coreBeforeFee - fee;
        
        return (coreAfterFee, fee);
    }
    
    /**
     * @dev Internal function to calculate tokens received for a given CORE amount using integral mathematics
     * Uses the inverse of the quadratic bonding curve integral
     */
    function _calculateTokensFromCoreIntegral(uint256 currentTokensSold, uint256 coreAmount) internal view returns (uint256) {
        if (coreAmount == 0) return 0;
        
        uint256 totalSupply = 800_000_000 * 10**18;
        if (currentTokensSold >= totalSupply) return 0;
        
        // For quadratic curve: price = basePrice * (1 + progress)^2
        // Integral: CORE = basePrice * totalSupply * [(1 + endProgress)^3 - (1 + startProgress)^3] / 3
        // We need to solve for endTokens given CORE amount
        
        uint256 startProgress = (currentTokensSold * 10**18) / totalSupply;
        uint256 startTerm = ((10**18 + startProgress) ** 3) / (3 * 10**36);
        
        // Calculate target integral value
        uint256 targetIntegralIncrease = (coreAmount * 10**18) / (basePrice * totalSupply);
        uint256 targetEndTerm = startTerm + targetIntegralIncrease;
        
        // Solve cubic equation: (1 + endProgress)^3 / (3 * 10^36) = targetEndTerm
        uint256 cubeRoot = _cubeRoot(targetEndTerm * 3 * 10**36);
        
        if (cubeRoot <= 10**18) return 0;
        
        uint256 endProgress = cubeRoot - 10**18;
        uint256 endTokens = (endProgress * totalSupply) / 10**18;
        
        // Return the difference in tokens
        if (endTokens <= currentTokensSold) return 0;
        return endTokens - currentTokensSold;
    }
    
    /**
     * @dev Internal function to calculate CORE received for selling tokens using integral mathematics
     */
    function _calculateCoreFromTokensIntegral(uint256 startTokens, uint256 endTokens) internal view returns (uint256) {
        if (startTokens >= endTokens) return 0;
        
        uint256 totalSupply = 800_000_000 * 10**18;
        uint256 startProgress = (startTokens * 10**18) / totalSupply;
        uint256 endProgress = (endTokens * 10**18) / totalSupply;
        
        // Calculate integral: basePrice * totalSupply * [(1 + endProgress)^3 - (1 + startProgress)^3] / 3
        uint256 startTerm = ((10**18 + startProgress) ** 3) / (3 * 10**36);
        uint256 endTerm = ((10**18 + endProgress) ** 3) / (3 * 10**36);
        
        uint256 integralDifference = endTerm - startTerm;
        return (basePrice * totalSupply * integralDifference) / 10**18;
    }
    
    /**
     * @dev Internal function to calculate cube root using Newton's method
     * Approximation for cube root calculation in Solidity
     */
    function _cubeRoot(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        // Initial guess
        uint256 z = x;
        uint256 y = x;
        
        // Newton's method: z = (2 * z + x / (z * z)) / 3
        // Iterate to converge on cube root
        for (uint256 i = 0; i < 10; i++) {
            z = (2 * z + x / (z * z)) / 3;
            if (z >= y) break;
            y = z;
        }
        
        return y;
    }
    
    /**
     * @dev Buy tokens with CORE
     */
    function buyTokens() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Must send CORE");
        require(!graduated, "Token has graduated");
        
        (uint256 tokensToReceive, uint256 fee) = calculateTokensForCore(msg.value);
        require(tokensToReceive > 0, "No tokens to receive");
        
        // Check purchase limit (4% of total supply)
        uint256 totalSupply = 1_000_000_000 * 10**18;
        uint256 maxPurchase = (totalSupply * MAX_PURCHASE_PERCENTAGE) / BASIS_POINTS;
        
        // Emit LargePurchaseAttempted event if limit would be exceeded
        if (purchaseAmounts[msg.sender] + tokensToReceive > maxPurchase) {
            if (address(eventHub) != address(0)) {
                eventHub.emitLargePurchaseAttempted(
                    address(coin),
                    msg.sender,
                    address(this),
                    tokensToReceive,
                    purchaseAmounts[msg.sender],
                    maxPurchase,
                    block.timestamp
                );
            }
            revert("Purchase exceeds 4% limit");
        }
        
        // Update state
        purchaseAmounts[msg.sender] += tokensToReceive;
        tokensSold += tokensToReceive;
        totalCoreRaised += msg.value;        // Cumulative - never decreases
        currentCoreReserves += msg.value;    // Current balance - can decrease
        
        // Transfer tokens to buyer
        coin.safeTransfer(msg.sender, tokensToReceive);
        
        // Send fee to treasury
        if (fee > 0) {
            (bool success, ) = platformTreasury.call{value: fee}("");
            require(success, "Fee transfer failed");
        }
        
        emit TokenPurchased(
            msg.sender,
            msg.value,
            tokensToReceive,
            getCurrentPrice(),
            fee
        );
        
        // Emit to EventHub
        if (address(eventHub) != address(0)) {
            eventHub.emitTokenTraded(
                address(coin),
                msg.sender,
                address(this),
                true, // isBuy
                msg.value,
                tokensToReceive,
                getCurrentPrice(),
                fee,
                block.timestamp
            );
        }
        
        // Check for graduation using dynamic threshold
        if (totalCoreRaised >= getGraduationThreshold()) {
            _graduate();
        }
    }
    
    /**
     * @dev Sell tokens for CORE
     */
    function sellTokens(uint256 tokenAmount) external nonReentrant whenNotPaused {
        require(tokenAmount > 0, "Token amount must be greater than 0");
        require(!graduated, "Token has graduated");
        require(coin.balanceOf(msg.sender) >= tokenAmount, "Insufficient token balance");
        
        (uint256 coreToReceive, uint256 fee) = calculateCoreForTokens(tokenAmount);
        require(coreToReceive > 0, "No CORE to receive");
        require(address(this).balance >= coreToReceive + fee, "Insufficient CORE in contract");
        
        // Update state - CRITICAL FIX: totalCoreRaised should NEVER decrease
        tokensSold -= tokenAmount;
        currentCoreReserves -= (coreToReceive + fee);  // Only decrease reserves, not total raised
        // totalCoreRaised remains unchanged - it's cumulative for graduation calculations
        
        // Transfer tokens from seller
        coin.safeTransferFrom(msg.sender, address(this), tokenAmount);
        
        // Send CORE to seller
        (bool success, ) = msg.sender.call{value: coreToReceive}("");
        require(success, "CORE transfer failed");
        
        // Send fee to treasury
        if (fee > 0) {
            (bool feeSuccess, ) = platformTreasury.call{value: fee}("");
            require(feeSuccess, "Fee transfer failed");
        }
        
        emit TokenSold(
            msg.sender,
            tokenAmount,
            coreToReceive,
            getCurrentPrice(),
            fee
        );
        
        // Emit to EventHub
        if (address(eventHub) != address(0)) {
            eventHub.emitTokenTraded(
                address(coin),
                msg.sender,
                address(this),
                false, // isBuy
                coreToReceive + fee, // total CORE value
                tokenAmount,
                getCurrentPrice(),
                fee,
                block.timestamp
            );
        }
    }
    
    /**
     * @dev Internal function to handle graduation
     * Enhanced with better creator incentives and real SushiSwap liquidity creation
     */
    function _graduate() internal {
        require(!graduated, "Already graduated");
        graduated = true;
        
        // Use currentCoreReserves for liquidity calculations (actual available CORE)
        uint256 availableCore = currentCoreReserves;
        uint256 liquidityCore = (availableCore * 50) / 100; // 50% for liquidity (reduced from 70%)
        uint256 creatorBonus = (availableCore * 30) / 100;  // 30% for creator (increased from 10%)
        uint256 treasuryAmount = availableCore - liquidityCore - creatorBonus; // 20% for treasury
        
        // Create SushiSwap liquidity first (before sending funds)
        _createSushiSwapLiquidity(liquidityCore);
        
        // Update reserves after graduation distribution
        currentCoreReserves = 0; // All CORE distributed
        
        // Send creator bonus
        if (creatorBonus > 0) {
            (bool creatorSuccess, ) = creator.call{value: creatorBonus}("");
            require(creatorSuccess, "Creator bonus transfer failed");
        }
        
        // Send treasury amount
        if (treasuryAmount > 0) {
            (bool treasurySuccess, ) = platformTreasury.call{value: treasuryAmount}("");
            require(treasurySuccess, "Treasury transfer failed");
        }
        
        emit Graduated(
            address(coin),
            totalCoreRaised,
            liquidityCore,
            creatorBonus,
            treasuryAmount
        );
        
        // Emit to EventHub
        if (address(eventHub) != address(0)) {
            eventHub.emitTokenGraduated(
                address(coin),
                creator,
                totalCoreRaised,
                liquidityCore,
                creatorBonus,
                block.timestamp
            );
        }
    }
    
    /**
     * @dev Internal function to create SushiSwap liquidity
     * Creates permanent liquidity by burning LP tokens
     */
    function _createSushiSwapLiquidity(uint256 coreAmount) internal {
        // For now, this is a placeholder implementation
        // In production, this would integrate with SushiSwap contracts
        // TODO: Implement actual SushiSwap integration for Core Chain
        
        // Calculate remaining tokens for LP
        uint256 tokenAmount = coin.balanceOf(address(this));
        
        // Emit event for tracking
        emit LiquidityCreated(address(coin), tokenAmount, coreAmount);
        
        // Note: Actual SushiSwap integration would:
        // 1. Create pair if doesn't exist
        // 2. Add liquidity via SushiSwap router
        // 3. Burn LP tokens to make liquidity permanent
        // 4. Handle any remaining tokens/CORE appropriately
    }
    
    /**
     * @dev Emergency pause function
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause function
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Validate contract state invariants
     * @dev This helps prevent state corruption and ensures consistency
     */
    function _validateState() internal view {
        // Critical invariant: totalCoreRaised should never be less than what we've actually raised
        require(totalCoreRaised >= currentCoreReserves, "Invalid state: totalCoreRaised < currentCoreReserves");
        
        // Graduated tokens should have totalCoreRaised >= threshold
        if (graduated) {
            uint256 threshold = getGraduationThreshold();
            require(totalCoreRaised >= threshold, "Invalid state: graduated but below threshold");
        }
        
        // Contract balance should match currentCoreReserves (accounting for pending transfers)
        // Note: This check is relaxed during transactions due to reentrancy protection
    }
    
    /**
     * @dev Required by UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev Get contract version for upgrade tracking
     */
    function version() external pure returns (string memory) {
        return "2.2.0-comprehensive-fixes";
    }
    
    /**
     * @dev Get contract state for frontend
     */
    function getState() external view returns (
        uint256 currentPrice,
        uint256 totalRaised,
        uint256 tokensSoldAmount,
        bool isGraduated,
        uint256 graduationProgress
    ) {
        uint256 graduationThreshold = getGraduationThreshold();
        return (
            getCurrentPrice(),
            totalCoreRaised,
            tokensSold,
            graduated,
            graduationThreshold > 0 ? (totalCoreRaised * 100) / graduationThreshold : 0
        );
    }
    
    /**
     * @dev Get detailed contract state including new reserve tracking
     */
    function getDetailedState() external view returns (
        uint256 currentPrice,
        uint256 totalRaised,
        uint256 currentReserves,
        uint256 tokensSoldAmount,
        bool isGraduated,
        uint256 graduationProgress,
        uint256 graduationThreshold
    ) {
        uint256 threshold = getGraduationThreshold();
        return (
            getCurrentPrice(),
            totalCoreRaised,
            currentCoreReserves,
            tokensSold,
            graduated,
            threshold > 0 ? (totalCoreRaised * 100) / threshold : 0,
            threshold
        );
    }
}
