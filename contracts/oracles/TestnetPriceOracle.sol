// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IPriceOracle.sol";
import "../EventHub.sol";

/**
 * @title TestnetPriceOracle
 * @dev Upgradeable price oracle for testnet with manual price setting
 * Allows owner to set CORE/USD price at intervals for testing
 */
contract TestnetPriceOracle is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    IPriceOracle 
{
    // Price storage
    uint256 private _price;
    uint256 private _lastUpdateTime;
    
    // EventHub integration
    EventHub public eventHub;
    
    // Events
    event PriceUpdated(uint256 indexed newPrice, uint256 timestamp, address updatedBy);
    event EventHubUpdated(address indexed oldEventHub, address indexed newEventHub);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the testnet price oracle
     * @param initialPrice The initial CORE price in USD (8 decimals)
     */
    function initialize(uint256 initialPrice) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        
        require(initialPrice > 0, "Initial price must be greater than 0");
        
        _price = initialPrice;
        _lastUpdateTime = block.timestamp;
        
        emit PriceUpdated(initialPrice, block.timestamp, msg.sender);
    }
    
    /**
     * @dev Set the EventHub contract address (only owner)
     * @param eventHub_ The EventHub contract address
     */
    function setEventHub(address eventHub_) external onlyOwner {
        address oldEventHub = address(eventHub);
        eventHub = EventHub(eventHub_);
        emit EventHubUpdated(oldEventHub, eventHub_);
    }
    
    /**
     * @dev Set a new CORE price (only owner)
     * @param newPrice The new price in USD with 8 decimal places
     */
    function setPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be greater than 0");
        require(newPrice <= 1000 * 1e8, "Price too high (max $1000)"); // Sanity check
        
        uint256 oldPrice = _price;
        _price = newPrice;
        _lastUpdateTime = block.timestamp;
        
        emit PriceUpdated(newPrice, block.timestamp, msg.sender);
        
        // Notify EventHub if configured and price actually changed
        if (address(eventHub) != address(0) && oldPrice != newPrice) {
            eventHub.emitPriceOracleUpdated(
                address(this),
                oldPrice,
                newPrice,
                block.timestamp
            );
        }
    }
    
    /**
     * @dev Get the current CORE price in USD
     * @return price The current price with 8 decimal places
     */
    function getPrice() external view override returns (uint256 price) {
        return _price;
    }
    
    /**
     * @dev Get the timestamp of the last price update
     * @return timestamp The last update timestamp
     */
    function getLastUpdateTime() external view override returns (uint256 timestamp) {
        return _lastUpdateTime;
    }
    
    /**
     * @dev Get price in a human-readable format
     * @return dollars The dollar amount (integer part)
     * @return cents The cents amount (fractional part)
     */
    function getPriceFormatted() external view returns (uint256 dollars, uint256 cents) {
        dollars = _price / 1e8;
        cents = (_price % 1e8) / 1e6; // Convert to 2 decimal places
    }
    
    /**
     * @dev Batch update multiple prices with timestamps (for testing scenarios)
     * @param prices Array of prices to set
     * @param intervals Array of time intervals between updates (in seconds)
     */
    function simulatePriceUpdates(
        uint256[] calldata prices,
        uint256[] calldata intervals
    ) external onlyOwner {
        require(prices.length == intervals.length, "Arrays length mismatch");
        require(prices.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < prices.length; i++) {
            require(prices[i] > 0, "Price must be greater than 0");
            require(prices[i] <= 1000 * 1e8, "Price too high");
            
            uint256 oldPrice = _price;
            _price = prices[i];
            _lastUpdateTime = block.timestamp + intervals[i];
            
            emit PriceUpdated(prices[i], _lastUpdateTime, msg.sender);
            
            // Notify EventHub if configured and price actually changed
            if (address(eventHub) != address(0) && oldPrice != prices[i]) {
                eventHub.emitPriceOracleUpdated(
                    address(this),
                    oldPrice,
                    prices[i],
                    _lastUpdateTime
                );
            }
        }
    }
    
    /**
     * @dev Required by UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev Get contract version for upgrades
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
