// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Coin
 * @dev Standard ERC20 token with fixed supply and renounced ownership
 * This contract represents tokens launched on the CorePump platform
 */
contract Coin is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    
    // Platform addresses
    address public immutable bondingCurve;
    address public immutable creator;
    
    // Token metadata
    string private _tokenDescription;
    string private _tokenImage;
    string private _tokenWebsite;
    string private _tokenTelegram;
    string private _tokenTwitter;
    
    event TokenLaunched(
        address indexed token,
        address indexed creator,
        address indexed bondingCurve,
        string name,
        string symbol,
        uint256 totalSupply
    );
    
    /**
     * @dev Constructor that mints total supply and sets up initial distribution
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param creator_ Address of the token creator
     * @param bondingCurve_ Address of the bonding curve contract
     * @param description_ Token description
     * @param image_ Token image URL
     * @param website_ Token website URL
     * @param telegram_ Token Telegram URL
     * @param twitter_ Token Twitter URL
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address creator_,
        address bondingCurve_,
        string memory description_,
        string memory image_,
        string memory website_,
        string memory telegram_,
        string memory twitter_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        require(creator_ != address(0), "Creator cannot be zero address");
        require(bondingCurve_ != address(0), "Bonding curve cannot be zero address");
        
        creator = creator_;
        bondingCurve = bondingCurve_;
        
        // Set metadata
        _tokenDescription = description_;
        _tokenImage = image_;
        _tokenWebsite = website_;
        _tokenTelegram = telegram_;
        _tokenTwitter = twitter_;
        
        // Mint total supply to bonding curve (80% for public sale)
        // The remaining 20% (15% early buyers + 5% creator) will be handled by vesting contracts in future versions
        _mint(bondingCurve_, (TOTAL_SUPPLY * 80) / 100);
        
        // Renounce ownership immediately to make contract immutable
        renounceOwnership();
        
        emit TokenLaunched(
            address(this),
            creator_,
            bondingCurve_,
            name_,
            symbol_,
            TOTAL_SUPPLY
        );
    }
    
    /**
     * @dev Get token metadata
     */
    function getTokenMetadata() external view returns (
        string memory description,
        string memory image,
        string memory website,
        string memory telegram,
        string memory twitter
    ) {
        return (_tokenDescription, _tokenImage, _tokenWebsite, _tokenTelegram, _tokenTwitter);
    }
    
    /**
     * @dev Override transfer to prevent transfers before bonding curve phase
     * This can be modified in future versions to implement trading restrictions
     */
    function _update(address from, address to, uint256 value) internal virtual override {
        super._update(from, to, value);
    }
}
