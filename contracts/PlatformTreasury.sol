// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title PlatformTreasury
 * @dev Upgradeable treasury contract for managing platform funds
 * Collects fees from token creation and bonding curve trading
 */
contract PlatformTreasury is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable 
{
    // Fee tracking
    uint256 public totalCreationFees;
    uint256 public totalTradingFees;
    uint256 public totalGraduationFees;
    uint256 public totalWithdrawn;
    
    // Authorized contracts
    mapping(address => bool) public authorizedContracts;
    
    // Manager mapping for contracts that can authorize other contracts
    mapping(address => bool) public authorizedManagers;
    
    // Events
    event FeeReceived(
        address indexed from,
        uint256 amount,
        string feeType
    );
    
    event Withdrawal(
        address indexed to,
        uint256 amount,
        string reason
    );
    
    event ContractAuthorized(address indexed contractAddress, bool authorized);
    event ManagerAuthorized(address indexed manager, bool authorized);
    
    // Modifier to restrict authorization to owner or managers
    modifier onlyOwnerOrManager() {
        require(owner() == msg.sender || authorizedManagers[msg.sender], "Treasury: Not authorized to manage");
        _;
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the treasury contract
     */
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
    }
    
    /**
     * @dev Receive function to accept CORE payments
     */
    receive() external payable {
        // Determine fee type based on sender
        string memory feeType = "unknown";
        
        if (authorizedContracts[msg.sender]) {
            // This is a rough categorization - in production, you'd want more specific tracking
            if (msg.value == 1 ether) {
                totalCreationFees += msg.value;
                feeType = "creation";
            } else {
                totalTradingFees += msg.value;
                feeType = "trading";
            }
        } else {
            // Direct payments or graduation fees
            totalGraduationFees += msg.value;
            feeType = "graduation";
        }
        
        emit FeeReceived(msg.sender, msg.value, feeType);
    }
    
    /**
     * @dev Fallback function
     */
    fallback() external payable {
        // Redirect to receive function
        emit FeeReceived(msg.sender, msg.value, "fallback");
    }
    
    /**
     * @dev Authorize a contract to send fees
     */
    function authorizeContract(address contractAddress, bool authorized) external onlyOwner {
        require(contractAddress != address(0), "Contract cannot be zero address");
        authorizedContracts[contractAddress] = authorized;
        emit ContractAuthorized(contractAddress, authorized);
    }
    
    /**
     * @dev Withdraw funds to a specific address
     */
    function withdraw(address to, uint256 amount, string memory reason) external onlyOwner nonReentrant {
        require(to != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(address(this).balance >= amount, "Insufficient balance");
        
        totalWithdrawn += amount;
        
        (bool success, ) = to.call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit Withdrawal(to, amount, reason);
    }
    
    /**
     * @dev Withdraw all funds to owner
     */
    function withdrawAll() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        totalWithdrawn += balance;
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
        
        emit Withdrawal(owner(), balance, "withdraw_all");
    }
    
    /**
     * @dev Get treasury statistics
     */
    function getTreasuryStats() external view returns (
        uint256 currentBalance,
        uint256 creationFees,
        uint256 tradingFees,
        uint256 graduationFees,
        uint256 totalWithdrawnAmount,
        uint256 totalReceived
    ) {
        return (
            address(this).balance,
            totalCreationFees,
            totalTradingFees,
            totalGraduationFees,
            totalWithdrawn,
            totalCreationFees + totalTradingFees + totalGraduationFees
        );
    }
    
    /**
     * @dev Check if contract is authorized
     */
    function isAuthorizedContract(address contractAddress) external view returns (bool) {
        return authorizedContracts[contractAddress];
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
     * @dev Get current balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Batch authorize multiple contracts
     */
    function batchAuthorizeContracts(
        address[] memory contracts,
        bool[] memory authorizations
    ) external onlyOwner {
        require(contracts.length == authorizations.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < contracts.length; i++) {
            require(contracts[i] != address(0), "Contract cannot be zero address");
            authorizedContracts[contracts[i]] = authorizations[i];
            emit ContractAuthorized(contracts[i], authorizations[i]);
        }
    }
    
    /**
     * @dev Authorize or deauthorize a manager (only owner)
     * @param manager The manager address to authorize/deauthorize
     * @param authorized True to authorize, false to deauthorize
     */
    function authorizeManager(address manager, bool authorized) external onlyOwner {
        require(manager != address(0), "Treasury: Invalid manager address");
        authorizedManagers[manager] = authorized;
        emit ManagerAuthorized(manager, authorized);
    }
    
    /**
     * @dev Authorize contract by manager or owner
     * @param contractAddress The contract address to authorize/deauthorize
     * @param authorized True to authorize, false to deauthorize
     */
    function managerAuthorizeContract(address contractAddress, bool authorized) external onlyOwnerOrManager {
        require(contractAddress != address(0), "Treasury: Invalid contract address");
        authorizedContracts[contractAddress] = authorized;
        emit ContractAuthorized(contractAddress, authorized);
    }
    
    /**
     * @dev Batch authorize multiple contracts by manager or owner
     * @param contracts Array of contract addresses
     * @param authorizations Array of authorization statuses
     */
    function managerBatchAuthorizeContracts(
        address[] memory contracts,
        bool[] memory authorizations
    ) external onlyOwnerOrManager {
        require(contracts.length == authorizations.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < contracts.length; i++) {
            require(contracts[i] != address(0), "Treasury: Invalid contract address");
            authorizedContracts[contracts[i]] = authorizations[i];
            emit ContractAuthorized(contracts[i], authorizations[i]);
        }
    }
    
    /**
     * @dev Get contract version for upgrades
     */
    function version() external pure returns (string memory) {
        return "2.0.0";
    }
}
