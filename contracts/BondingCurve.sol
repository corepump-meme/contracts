// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./oracles/IPriceOracle.sol";
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
    uint256 public constant GRADUATION_USD_THRESHOLD = 50000; // $50,000 USD
    
    // Token and platform addresses
    IERC20 public coin;
    address public platformTreasury;
    address public creator;
    IPriceOracle public priceOracle;
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
        priceOracle = IPriceOracle(priceOracle_);
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
     * @return threshold The amount of CORE needed for graduation
     */
    function getGraduationThreshold() public view returns (uint256 threshold) {
        uint256 corePrice = priceOracle.getPrice(); // Price in USD with 8 decimals
        // Calculate CORE needed for $50,000: (50000 * 1e8 * 1e18) / corePrice
        return (GRADUATION_USD_THRESHOLD * 1e26) / corePrice;
    }
    
    /**
     * @dev Calculate tokens received for a given CORE amount
     */
    function calculateTokensForCore(uint256 coreAmount) public view returns (uint256, uint256) {
        require(coreAmount > 0, "CORE amount must be greater than 0");
        require(!graduated, "Token has graduated");
        
        uint256 fee = (coreAmount * PLATFORM_FEE) / BASIS_POINTS;
        uint256 coreAfterFee = coreAmount - fee;
        
        // Simplified calculation - in production, this would use integral calculus
        // For MVP, we'll use average price approximation
        uint256 currentPrice = getCurrentPrice();
        uint256 tokensToReceive = (coreAfterFee * 10**18) / currentPrice;
        
        // Check if purchase would exceed available tokens
        uint256 totalSupply = 800_000_000 * 10**18;
        if (tokensSold + tokensToReceive > totalSupply) {
            tokensToReceive = totalSupply - tokensSold;
        }
        
        return (tokensToReceive, fee);
    }
    
    /**
     * @dev Calculate CORE received for selling tokens
     */
    function calculateCoreForTokens(uint256 tokenAmount) public view returns (uint256, uint256) {
        require(tokenAmount > 0, "Token amount must be greater than 0");
        require(tokenAmount <= tokensSold, "Cannot sell more than sold");
        require(!graduated, "Token has graduated");
        
        // Simplified calculation - use current price
        uint256 currentPrice = getCurrentPrice();
        uint256 coreBeforeFee = (tokenAmount * currentPrice) / 10**18;
        uint256 fee = (coreBeforeFee * PLATFORM_FEE) / BASIS_POINTS;
        uint256 coreAfterFee = coreBeforeFee - fee;
        
        return (coreAfterFee, fee);
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
     */
    function _graduate() internal {
        require(!graduated, "Already graduated");
        graduated = true;
        
        // Use currentCoreReserves for liquidity calculations (actual available CORE)
        uint256 availableCore = currentCoreReserves;
        uint256 liquidityCore = (availableCore * 70) / 100; // 70% for liquidity
        uint256 creatorBonus = (availableCore * 10) / 100; // 10% for creator
        uint256 treasuryAmount = availableCore - liquidityCore - creatorBonus; // 20% for treasury
        
        // Update reserves after graduation distribution
        currentCoreReserves = liquidityCore; // Keep liquidity portion in contract
        
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
        
        // Note: In full implementation, liquidityCore would be used to create DEX liquidity
        // For MVP, we'll keep it in the contract for now
        
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
