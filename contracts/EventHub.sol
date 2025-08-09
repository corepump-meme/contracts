// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title EventHub
 * @dev Centralized event system for CorePump platform
 * Aggregates all platform events for efficient subgraph indexing
 */
contract EventHub is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    
    // Authorization mapping for contracts that can emit events
    mapping(address => bool) public authorizedContracts;
    
    // Manager mapping for contracts that can authorize other contracts
    mapping(address => bool) public authorizedManagers;
    
    // Modifier to restrict event emission to authorized contracts
    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender], "EventHub: Not authorized");
        _;
    }
    
    // Modifier to restrict authorization to owner or managers
    modifier onlyOwnerOrManager() {
        require(owner() == msg.sender || authorizedManagers[msg.sender], "EventHub: Not authorized to manage");
        _;
    }
    
    // Core platform events
    event TokenLaunched(
        address indexed token,
        address indexed creator,
        address indexed bondingCurve,
        string name,
        string symbol,
        uint256 timestamp,
        uint256 creationFee
    );
    
    event TokenTraded(
        address indexed token,
        address indexed trader,
        address indexed bondingCurve,
        bool isBuy,
        uint256 coreAmount,
        uint256 tokenAmount,
        uint256 newPrice,
        uint256 fee,
        uint256 timestamp
    );
    
    event TokenGraduated(
        address indexed token,
        address indexed creator,
        uint256 totalRaised,
        uint256 liquidityCore,
        uint256 creatorBonus,
        uint256 timestamp
    );
    
    event PriceOracleUpdated(
        address indexed oracle,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 timestamp
    );
    
    event PlatformFeeCollected(
        address indexed source,
        string feeType,
        uint256 amount,
        uint256 timestamp
    );
    
    // Enhanced tracking events
    event LargePurchaseAttempted(
        address indexed token,
        address indexed buyer,
        address indexed bondingCurve,
        uint256 attemptedAmount,
        uint256 currentHoldings,
        uint256 maxAllowed,
        uint256 timestamp
    );
    
    event GraduationThresholdUpdated(
        address indexed token,
        address indexed bondingCurve,
        uint256 oldThreshold,
        uint256 newThreshold,
        uint256 corePrice,
        uint256 timestamp
    );
    
    // Authorization events
    event ContractAuthorized(address indexed contractAddress, bool authorized);
    event ManagerAuthorized(address indexed manager, bool authorized);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the EventHub contract
     */
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }
    
    /**
     * @dev Authorize or deauthorize a contract to emit events
     * @param contractAddress The contract address to authorize/deauthorize
     * @param authorized True to authorize, false to deauthorize
     */
    function authorizeContract(address contractAddress, bool authorized) external onlyOwner {
        require(contractAddress != address(0), "EventHub: Invalid contract address");
        authorizedContracts[contractAddress] = authorized;
        emit ContractAuthorized(contractAddress, authorized);
    }
    
    /**
     * @dev Batch authorize multiple contracts
     * @param contractAddresses Array of contract addresses
     * @param authorized Authorization status for all contracts
     */
    function batchAuthorizeContracts(address[] calldata contractAddresses, bool authorized) external onlyOwner {
        for (uint256 i = 0; i < contractAddresses.length; i++) {
            require(contractAddresses[i] != address(0), "EventHub: Invalid contract address");
            authorizedContracts[contractAddresses[i]] = authorized;
            emit ContractAuthorized(contractAddresses[i], authorized);
        }
    }
    
    /**
     * @dev Authorize or deauthorize a manager (only owner)
     * @param manager The manager address to authorize/deauthorize
     * @param authorized True to authorize, false to deauthorize
     */
    function authorizeManager(address manager, bool authorized) external onlyOwner {
        require(manager != address(0), "EventHub: Invalid manager address");
        authorizedManagers[manager] = authorized;
        emit ManagerAuthorized(manager, authorized);
    }
    
    /**
     * @dev Authorize contract by manager or owner
     * @param contractAddress The contract address to authorize/deauthorize
     * @param authorized True to authorize, false to deauthorize
     */
    function managerAuthorizeContract(address contractAddress, bool authorized) external onlyOwnerOrManager {
        require(contractAddress != address(0), "EventHub: Invalid contract address");
        authorizedContracts[contractAddress] = authorized;
        emit ContractAuthorized(contractAddress, authorized);
    }
    
    /**
     * @dev Batch authorize multiple contracts by manager or owner
     * @param contractAddresses Array of contract addresses
     * @param authorized Authorization status for all contracts
     */
    function managerBatchAuthorizeContracts(address[] calldata contractAddresses, bool authorized) external onlyOwnerOrManager {
        for (uint256 i = 0; i < contractAddresses.length; i++) {
            require(contractAddresses[i] != address(0), "EventHub: Invalid contract address");
            authorizedContracts[contractAddresses[i]] = authorized;
            emit ContractAuthorized(contractAddresses[i], authorized);
        }
    }
    
    // Event emission functions (only authorized contracts)
    
    /**
     * @dev Emit TokenLaunched event
     */
    function emitTokenLaunched(
        address token,
        address creator,
        address bondingCurve,
        string calldata name,
        string calldata symbol,
        uint256 timestamp,
        uint256 creationFee
    ) external onlyAuthorized {
        emit TokenLaunched(token, creator, bondingCurve, name, symbol, timestamp, creationFee);
    }
    
    /**
     * @dev Emit TokenTraded event
     */
    function emitTokenTraded(
        address token,
        address trader,
        address bondingCurve,
        bool isBuy,
        uint256 coreAmount,
        uint256 tokenAmount,
        uint256 newPrice,
        uint256 fee,
        uint256 timestamp
    ) external onlyAuthorized {
        emit TokenTraded(token, trader, bondingCurve, isBuy, coreAmount, tokenAmount, newPrice, fee, timestamp);
    }
    
    /**
     * @dev Emit TokenGraduated event
     */
    function emitTokenGraduated(
        address token,
        address creator,
        uint256 totalRaised,
        uint256 liquidityCore,
        uint256 creatorBonus,
        uint256 timestamp
    ) external onlyAuthorized {
        emit TokenGraduated(token, creator, totalRaised, liquidityCore, creatorBonus, timestamp);
    }
    
    /**
     * @dev Emit PriceOracleUpdated event
     */
    function emitPriceOracleUpdated(
        address oracle,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 timestamp
    ) external onlyAuthorized {
        emit PriceOracleUpdated(oracle, oldPrice, newPrice, timestamp);
    }
    
    /**
     * @dev Emit PlatformFeeCollected event
     */
    function emitPlatformFeeCollected(
        address source,
        string calldata feeType,
        uint256 amount,
        uint256 timestamp
    ) external onlyAuthorized {
        emit PlatformFeeCollected(source, feeType, amount, timestamp);
    }
    
    /**
     * @dev Emit LargePurchaseAttempted event
     */
    function emitLargePurchaseAttempted(
        address token,
        address buyer,
        address bondingCurve,
        uint256 attemptedAmount,
        uint256 currentHoldings,
        uint256 maxAllowed,
        uint256 timestamp
    ) external onlyAuthorized {
        emit LargePurchaseAttempted(token, buyer, bondingCurve, attemptedAmount, currentHoldings, maxAllowed, timestamp);
    }
    
    /**
     * @dev Emit GraduationThresholdUpdated event
     */
    function emitGraduationThresholdUpdated(
        address token,
        address bondingCurve,
        uint256 oldThreshold,
        uint256 newThreshold,
        uint256 corePrice,
        uint256 timestamp
    ) external onlyAuthorized {
        emit GraduationThresholdUpdated(token, bondingCurve, oldThreshold, newThreshold, corePrice, timestamp);
    }
    
    /**
     * @dev Check if a contract is authorized to emit events
     * @param contractAddress The contract address to check
     * @return True if authorized, false otherwise
     */
    function isAuthorized(address contractAddress) external view returns (bool) {
        return authorizedContracts[contractAddress];
    }
    
    /**
     * @dev Required by UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev Get contract version for upgrades
     */
    function version() external pure returns (string memory) {
        return "2.0.0";
    }
}
