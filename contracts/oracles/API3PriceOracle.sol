// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IPriceOracle.sol";

/**
 * @title IApi3ReaderProxy
 * @dev Interface for API3's data feed reader proxy
 */
interface IApi3ReaderProxy {
    function read() external view returns (int224 value, uint32 timestamp);
}

/**
 * @title API3PriceOracle
 * @dev Price oracle that reads CORE/USD price from API3's data feed
 * Used for mainnet deployment with real price data
 */
contract API3PriceOracle is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    IPriceOracle 
{
    // API3 proxy contract
    IApi3ReaderProxy public immutable api3Proxy;
    
    // Price validation
    uint256 public constant MAX_PRICE_AGE = 3600; // 1 hour in seconds
    uint256 public constant MIN_PRICE = 1e6; // $0.01 minimum
    uint256 public constant MAX_PRICE = 1000 * 1e8; // $1000 maximum
    
    // Events
    event PriceRead(int224 rawValue, uint32 timestamp, uint256 convertedPrice);
    event ProxyUpdated(address indexed oldProxy, address indexed newProxy);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _api3Proxy) {
        require(_api3Proxy != address(0), "API3 proxy cannot be zero address");
        api3Proxy = IApi3ReaderProxy(_api3Proxy);
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the API3 price oracle
     */
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }
    
    /**
     * @dev Get the current CORE price in USD from API3
     * @return price The current price with 8 decimal places
     */
    function getPrice() external view override returns (uint256 price) {
        (int224 rawValue, uint32 timestamp) = api3Proxy.read();
        
        // Validate timestamp (price shouldn't be too old)
        require(
            block.timestamp - timestamp <= MAX_PRICE_AGE,
            "Price data too old"
        );
        
        // Convert to uint256 and validate
        require(rawValue > 0, "Invalid price from API3");
        price = uint256(int256(rawValue));
        
        // Sanity checks
        require(price >= MIN_PRICE, "Price too low");
        require(price <= MAX_PRICE, "Price too high");
        
        return price;
    }
    
    /**
     * @dev Get the timestamp of the last price update from API3
     * @return timestamp The last update timestamp
     */
    function getLastUpdateTime() external view override returns (uint256 timestamp) {
        (, uint32 api3Timestamp) = api3Proxy.read();
        return uint256(api3Timestamp);
    }
    
    /**
     * @dev Get raw price data from API3 (for debugging)
     * @return value The raw price value from API3
     * @return timestamp The timestamp from API3
     */
    function getRawPriceData() external view returns (int224 value, uint32 timestamp) {
        return api3Proxy.read();
    }
    
    /**
     * @dev Get price in a human-readable format
     * @return dollars The dollar amount (integer part)
     * @return cents The cents amount (fractional part)
     */
    function getPriceFormatted() external view returns (uint256 dollars, uint256 cents) {
        uint256 price = this.getPrice();
        dollars = price / 1e8;
        cents = (price % 1e8) / 1e6; // Convert to 2 decimal places
    }
    
    /**
     * @dev Check if the price data is fresh
     * @return fresh True if price is within acceptable age limit
     */
    function isPriceFresh() external view returns (bool fresh) {
        (, uint32 timestamp) = api3Proxy.read();
        return (block.timestamp - timestamp) <= MAX_PRICE_AGE;
    }
    
    /**
     * @dev Get the API3 proxy address
     * @return proxy The address of the API3 reader proxy
     */
    function getProxyAddress() external view returns (address proxy) {
        return address(api3Proxy);
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
