// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IPriceOracle
 * @dev Interface for price oracles to get CORE/USD price
 */
interface IPriceOracle {
    /**
     * @dev Returns the current CORE price in USD
     * @return price The price with 8 decimal places (e.g., 100000000 = $1.00)
     */
    function getPrice() external view returns (uint256 price);
    
    /**
     * @dev Returns the timestamp of the last price update
     * @return timestamp The last update timestamp
     */
    function getLastUpdateTime() external view returns (uint256 timestamp);
}
