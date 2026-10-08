// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StellarStore} from "../src/StellarStore.sol";

/// @notice Deploys StellarStore (exactly 1 transaction). The deployer becomes admin and the initial treasury.
/// @dev Env: PRIVATE_KEY (deployer key, never hard-coded) and VLAD_TOKEN (the deployed $VLAD from Stellar-Faucet).
///      Later, the Stellar-Arena deploy calls grantRole(GAME_ROLE, arena) and setTreasury(arena).
///      Run with --slow --skip-simulation: the local Cancun simulation underestimates Sepolia creation gas.
contract Deploy is Script {
    string internal constant BASE_URI = "https://vladimirradev.github.io/Stellar-Store/metadata/";

    function run() external returns (StellarStore store) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address vladToken = vm.envAddress("VLAD_TOKEN");
        require(vladToken.code.length > 0, "VLAD_TOKEN has no code on this chain");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        store = new StellarStore(IERC20(vladToken), deployer, BASE_URI); // tx 1
        vm.stopBroadcast();

        console.log("Deployer     :", deployer);
        console.log("VLAD token   :", vladToken);
        console.log("StellarStore :", address(store));
    }
}
