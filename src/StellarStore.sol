// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title StellarStore - ERC-1155 game items paid in $VLAD
/// @notice Players buy Arena items with VLAD; every VLAD paid goes to `treasury`.
///         Accounts holding GAME_ROLE (the Stellar Arena) burn items when they are used and mint trophies.
/// @dev Implements the functions listed in IStellarStore (constants SWORD/SHIELD/TROPHY, balanceOf, consume, award).
contract StellarStore is ERC1155, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    uint256 public constant SWORD = 1;
    uint256 public constant SHIELD = 2;
    uint256 public constant TROPHY = 3;

    IERC20 public immutable vlad;
    address public treasury;
    string private _baseUri;

    struct Item {
        uint256 price; // VLAD (18 decimals) per unit
        bool buyable; // false = can only be awarded by GAME_ROLE
        string name;
    }

    mapping(uint256 => Item) public items;

    event ItemSet(uint256 indexed id, uint256 price, bool buyable, string name);
    event Purchased(address indexed buyer, uint256 indexed id, uint256 amount, uint256 cost);
    event Consumed(address indexed owner, uint256 indexed id, uint256 amount, address indexed by);
    event Awarded(address indexed to, uint256 indexed id, uint256 amount, address indexed by);
    event TreasuryUpdated(address treasury);

    error ItemNotBuyable();
    error ZeroAmount();
    error ZeroAddress();

    constructor(IERC20 vlad_, address treasury_, string memory baseUri_) ERC1155("") {
        if (address(vlad_) == address(0) || treasury_ == address(0)) revert ZeroAddress();
        vlad = vlad_;
        treasury = treasury_;
        _baseUri = baseUri_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setItem(SWORD, 25e18, true, "Guardian Sword");
        _setItem(SHIELD, 40e18, true, "Guardian Shield");
        _setItem(TROPHY, 0, false, "Arena Trophy");
        emit TreasuryUpdated(treasury_);
    }

    /// @notice Pays `price * amount` VLAD to the treasury and mints `amount` of item `id` to the caller.
    /// @dev The caller must first approve this contract for at least the cost on the VLAD token.
    function buy(uint256 id, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Item storage item = items[id];
        if (!item.buyable) revert ItemNotBuyable();
        uint256 cost = item.price * amount;
        emit Purchased(msg.sender, id, amount, cost);
        // Interactions last: VLAD payment first, then the mint (its receiver hook is the final external call).
        vlad.safeTransferFrom(msg.sender, treasury, cost);
        _mint(msg.sender, id, amount, "");
    }

    /// @notice Burns `amount` of item `id` from `from` (the Arena spends an item the player committed to a run).
    function consume(address from, uint256 id, uint256 amount) external onlyRole(GAME_ROLE) {
        if (amount == 0) revert ZeroAmount();
        _burn(from, id, amount);
        emit Consumed(from, id, amount, msg.sender);
    }

    /// @notice Mints `amount` of item `id` to `to` (the Arena awards a trophy for a won run).
    function award(address to, uint256 id, uint256 amount) external onlyRole(GAME_ROLE) {
        if (amount == 0) revert ZeroAmount();
        emit Awarded(to, id, amount, msg.sender);
        _mint(to, id, amount, "");
    }

    function setItem(uint256 id, uint256 price, bool buyable, string calldata name)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setItem(id, price, buyable, name);
    }

    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setBaseUri(string calldata baseUri_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseUri = baseUri_;
    }

    /// @notice Returns `<baseUri><id>.json`, for example ".../metadata/1.json".
    function uri(uint256 id) public view override returns (string memory) {
        return string.concat(_baseUri, Strings.toString(id), ".json");
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _setItem(uint256 id, uint256 price, bool buyable, string memory name) private {
        items[id] = Item(price, buyable, name);
        emit ItemSet(id, price, buyable, name);
    }
}
