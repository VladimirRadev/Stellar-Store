// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStellarStore} from "./interfaces/IStellarStore.sol";

/// @title StellarForge - redeem Arena Trophies for StellarStore items
/// @notice A player who holds Arena Trophies (StellarStore id 3) can trade them for a Guardian Sword (2 trophies
///         each) or a Guardian Shield (3 trophies each). One `redeem` call burns the trophies and mints the items in
///         the same transaction, so the player never approves anything.
/// @dev The Forge must hold StellarStore's GAME_ROLE, because it calls `consume` (burn) and `award` (mint).
///      Trust model: `redeem` only ever burns trophies from `msg.sender` and mints to `msg.sender`; no function
///      takes another account as a parameter. Holding GAME_ROLE therefore does not let the Forge, or anyone who
///      calls it, touch another player's items. The owner can only change prices (`setTrophyPrice`).
contract StellarForge is Ownable {
    /// @dev Item ids, mirrored from StellarStore.
    uint256 public constant SWORD = 1;
    uint256 public constant SHIELD = 2;
    uint256 public constant TROPHY = 3;

    /// @notice The StellarStore whose trophies are burned and whose items are minted.
    IStellarStore public immutable store;

    /// @notice Trophies burned per unit of `itemId`; 0 means the item cannot be redeemed.
    mapping(uint256 itemId => uint256 trophies) public trophyPrice;

    event Redeemed(address indexed player, uint256 indexed itemId, uint256 amount, uint256 trophiesBurned);
    event TrophyPriceSet(uint256 indexed itemId, uint256 trophies);

    error ZeroAmount();
    error ZeroAddress();
    error NotRedeemable(uint256 itemId);
    error InsufficientTrophies(uint256 have, uint256 need);

    constructor(IStellarStore store_, address owner_) Ownable(owner_) {
        if (address(store_) == address(0)) revert ZeroAddress();
        store = store_;
        _setTrophyPrice(SWORD, 2);
        _setTrophyPrice(SHIELD, 3);
    }

    /// @notice Burns `trophyPrice[itemId] * amount` of the caller's trophies and mints `amount` of `itemId` to them.
    function redeem(uint256 itemId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint256 price = trophyPrice[itemId];
        if (price == 0) revert NotRedeemable(itemId);
        uint256 cost = price * amount;
        uint256 have = store.balanceOf(msg.sender, TROPHY);
        if (have < cost) revert InsufficientTrophies(have, cost);

        emit Redeemed(msg.sender, itemId, amount, cost);
        // Burn first, then mint: the mint's onERC1155Received hook on the caller is the last external call.
        store.consume(msg.sender, TROPHY, cost);
        store.award(msg.sender, itemId, amount);
    }

    /// @notice Trophies needed to redeem `amount` of `itemId` (0 if the item is not redeemable).
    function quote(uint256 itemId, uint256 amount) external view returns (uint256 trophies) {
        return trophyPrice[itemId] * amount;
    }

    /// @notice Sets the trophy price of `itemId`; 0 disables redemption. Trophies cannot be redeemed for trophies.
    function setTrophyPrice(uint256 itemId, uint256 trophies) external onlyOwner {
        if (itemId == TROPHY) revert NotRedeemable(itemId);
        _setTrophyPrice(itemId, trophies);
    }

    function _setTrophyPrice(uint256 itemId, uint256 trophies) private {
        trophyPrice[itemId] = trophies;
        emit TrophyPriceSet(itemId, trophies);
    }
}
