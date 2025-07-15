// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./Coin.sol";
import "./BondingCurve.sol";
import "./oracles/IPriceOracle.sol";
import "./EventHub.sol";

/**
 * @title CoinFactory
 * @dev Upgradeable factory contract for creating new tokens and bonding curves
 * Main entry point for the CorePump platform
 */
contract CoinFactory is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable 
{
    using Clones for address;
    
    // Constants
    uint256 public constant CREATION_FEE = 1 ether; // 1 CORE
    uint256 public constant BASE_PRICE = 0.0001 ether; // Starting price: 0.0001 CORE per token
    
    // Platform addresses
    address public platformTreasury;
    address public coinImplementation;
    address public bondingCurveImplementation;
    IPriceOracle public priceOracle;
    EventHub public eventHub;
    
    // Tracking
    address[] public allCoins;
    mapping(address => address) public coinToBondingCurve;
    mapping(address => bool) public isValidCoin;
    
    // Events
    event CoinCreated(
        address indexed coin,
        address indexed bondingCurve,
        address indexed creator,
        string name,
        string symbol,
        uint256 creationFee
    );
    
    event PlatformTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event ImplementationUpdated(string contractType, address indexed oldImpl, address indexed newImpl);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the factory contract
     * @param platformTreasury_ The platform treasury address
     * @param coinImplementation_ The coin implementation contract address
     * @param bondingCurveImplementation_ The bonding curve implementation contract address
     * @param priceOracle_ The price oracle contract address
     * @param eventHub_ The event hub contract address
     */
    function initialize(
        address platformTreasury_,
        address coinImplementation_,
        address bondingCurveImplementation_,
        address priceOracle_,
        address eventHub_
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        require(platformTreasury_ != address(0), "Treasury cannot be zero address");
        require(coinImplementation_ != address(0), "Coin implementation cannot be zero address");
        require(bondingCurveImplementation_ != address(0), "Bonding curve implementation cannot be zero address");
        require(priceOracle_ != address(0), "Price oracle cannot be zero address");
        require(eventHub_ != address(0), "Event hub cannot be zero address");
        
        platformTreasury = platformTreasury_;
        coinImplementation = coinImplementation_;
        bondingCurveImplementation = bondingCurveImplementation_;
        priceOracle = IPriceOracle(priceOracle_);
        eventHub = EventHub(eventHub_);
    }
    
    /**
     * @dev Create a new token with bonding curve
     * @param name Token name
     * @param symbol Token symbol
     * @param description Token description
     * @param image Token image URL
     * @param website Token website URL
     * @param telegram Token Telegram URL
     * @param twitter Token Twitter URL
     */
    function createCoin(
        string memory name,
        string memory symbol,
        string memory description,
        string memory image,
        string memory website,
        string memory telegram,
        string memory twitter
    ) external payable nonReentrant whenNotPaused {
        require(msg.value >= CREATION_FEE, "Insufficient creation fee");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(bytes(symbol).length <= 10, "Symbol too long");
        
        // Create bonding curve proxy
        address bondingCurveProxy = bondingCurveImplementation.clone();
        
        // Create coin contract
        Coin coin = new Coin(
            name,
            symbol,
            msg.sender, // creator
            bondingCurveProxy, // bonding curve
            description,
            image,
            website,
            telegram,
            twitter
        );
        
        // Initialize bonding curve
        BondingCurve(bondingCurveProxy).initialize(
            address(coin),
            msg.sender, // creator
            platformTreasury,
            BASE_PRICE,
            address(priceOracle),
            address(eventHub)
        );
        
        // Update tracking
        allCoins.push(address(coin));
        coinToBondingCurve[address(coin)] = bondingCurveProxy;
        isValidCoin[address(coin)] = true;
        
        // Send creation fee to treasury
        (bool success, ) = platformTreasury.call{value: CREATION_FEE}("");
        require(success, "Fee transfer failed");
        
        // Refund excess payment
        if (msg.value > CREATION_FEE) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - CREATION_FEE}("");
            require(refundSuccess, "Refund failed");
        }
        
        emit CoinCreated(
            address(coin),
            bondingCurveProxy,
            msg.sender,
            name,
            symbol,
            CREATION_FEE
        );
        
        // Emit to EventHub
        if (address(eventHub) != address(0)) {
            eventHub.emitTokenLaunched(
                address(coin),
                msg.sender,
                bondingCurveProxy,
                name,
                symbol,
                block.timestamp,
                CREATION_FEE
            );
        }
    }
    
    /**
     * @dev Get all created coins
     */
    function getAllCoins() external view returns (address[] memory) {
        return allCoins;
    }
    
    /**
     * @dev Get total number of coins created
     */
    function getTotalCoins() external view returns (uint256) {
        return allCoins.length;
    }
    
    /**
     * @dev Get coin info by index
     */
    function getCoinByIndex(uint256 index) external view returns (
        address coin,
        address bondingCurve,
        string memory name,
        string memory symbol
    ) {
        require(index < allCoins.length, "Index out of bounds");
        
        coin = allCoins[index];
        bondingCurve = coinToBondingCurve[coin];
        
        Coin coinContract = Coin(coin);
        name = coinContract.name();
        symbol = coinContract.symbol();
    }
    
    /**
     * @dev Get coin details including metadata
     */
    function getCoinDetails(address coinAddress) external view returns (
        address coin,
        address bondingCurve,
        address creator,
        string memory name,
        string memory symbol,
        string memory description,
        string memory image,
        string memory website,
        string memory telegram,
        string memory twitter
    ) {
        require(isValidCoin[coinAddress], "Invalid coin address");
        
        coin = coinAddress;
        bondingCurve = coinToBondingCurve[coinAddress];
        
        Coin coinContract = Coin(coinAddress);
        creator = coinContract.creator();
        name = coinContract.name();
        symbol = coinContract.symbol();
        
        (description, image, website, telegram, twitter) = coinContract.getTokenMetadata();
    }
    
    /**
     * @dev Update platform treasury address
     */
    function updatePlatformTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Treasury cannot be zero address");
        address oldTreasury = platformTreasury;
        platformTreasury = newTreasury;
        emit PlatformTreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /**
     * @dev Update coin implementation
     */
    function updateCoinImplementation(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "Implementation cannot be zero address");
        address oldImplementation = coinImplementation;
        coinImplementation = newImplementation;
        emit ImplementationUpdated("Coin", oldImplementation, newImplementation);
    }
    
    /**
     * @dev Update bonding curve implementation
     */
    function updateBondingCurveImplementation(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "Implementation cannot be zero address");
        address oldImplementation = bondingCurveImplementation;
        bondingCurveImplementation = newImplementation;
        emit ImplementationUpdated("BondingCurve", oldImplementation, newImplementation);
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
     * @dev Required by UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev Get platform statistics
     */
    function getPlatformStats() external view returns (
        uint256 totalCoins,
        uint256 creationFee,
        uint256 basePrice,
        address treasury
    ) {
        return (
            allCoins.length,
            CREATION_FEE,
            BASE_PRICE,
            platformTreasury
        );
    }
    
    /**
     * @dev Emergency withdrawal function (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
    }
}
