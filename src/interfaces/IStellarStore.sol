// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Interface the Stellar Arena uses to spend and award StellarStore items.
interface IStellarStore {
    function SWORD() external view returns (uint256);
    function SHIELD() external view returns (uint256);
    function TROPHY() external view returns (uint256);
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function consume(address from, uint256 id, uint256 amount) external;
    function award(address to, uint256 id, uint256 amount) external;
}
