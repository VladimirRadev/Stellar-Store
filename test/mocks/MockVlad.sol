// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test stand-in for the real $VLAD token (deployed by Stellar-Faucet): plain ERC-20 with open mint.
contract MockVlad is ERC20("Vladimir", "VLAD") {
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
