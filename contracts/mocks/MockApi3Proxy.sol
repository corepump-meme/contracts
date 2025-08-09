// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MockApi3Proxy
 * @dev Mock contract for testing API3PriceOracle
 */
contract MockApi3Proxy {
    int224 public price;
    uint32 public timestamp;
    
    constructor() {
        price = 0;
        timestamp = 0;
    }
    
    function updatePrice(int224 _price, uint32 _timestamp) external {
        price = _price;
        timestamp = _timestamp;
    }
    
    function read() external view returns (int224, uint32) {
        return (price, timestamp);
    }
}
