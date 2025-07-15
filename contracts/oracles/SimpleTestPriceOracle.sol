// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IPriceOracle.sol";

/**
 * @title SimpleTestPriceOracle
 * @dev Simple non-upgradeable price oracle for testing
 * Allows setting CORE/USD price manually for testing scenarios
 */
contract SimpleTestPriceOracle is IPriceOracle {
    // Price storage
    uint256 private _price;
    uint256 private _lastUpdateTime;
    address public owner;
    
    // Events
    event PriceUpdated(uint256 indexed newPrice, uint256 timestamp, address updatedBy);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    /**
     * @dev Constructor sets initial price and owner
     * @param initialPrice The initial CORE price in USD (8 decimals)
     */
    constructor(uint256 initialPrice) {
        require(initialPrice > 0, "Initial price must be greater than 0");
        
        owner = msg.sender;
        _price = initialPrice;
        _lastUpdateTime = block.timestamp;
        
        emit PriceUpdated(initialPrice, block.timestamp, msg.sender);
    }
    
    /**
     * @dev Set a new CORE price (only owner)
     * @param newPrice The new price in USD with 8 decimal places
     */
    function setPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be greater than 0");
        require(newPrice <= 1000 * 1e8, "Price too high (max $1000)"); // Sanity check
        
        _price = newPrice;
        _lastUpdateTime = block.timestamp;
        
        emit PriceUpdated(newPrice, block.timestamp, msg.sender);
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
}
