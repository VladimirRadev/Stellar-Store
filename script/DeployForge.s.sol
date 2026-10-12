// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {StellarStore} from "../src/StellarStore.sol";
import {StellarForge} from "../src/StellarForge.sol";
import {IStellarStore} from "../src/interfaces/IStellarStore.sol";

/// @notice Deploys StellarForge and grants it the store's GAME_ROLE (2 transactions, one broadcast).
/// @dev Env: PRIVATE_KEY (the StellarStore admin key, never hard-coded) and optionally STELLAR_STORE
///      (defaults to the Sepolia StellarStore). The deployer becomes the Forge owner.
///      Run with --slow --skip-simulation: the local Cancun simulation underestimates Sepolia creation gas.
///      If the node rejects a send with the EIP-7702 "in-flight transaction limit reached for delegated accounts",
///      wait ~20 s and rerun the same command with --resume. Verify with Sourcify and Blockscout as in README.md.
contract DeployForge is Script {
    address internal constant SEPOLIA_STORE = 0xc1F24EF5887bD340E0d992e8557A4b6E977f151b;

    function run() external returns (StellarForge forge) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address storeAddress = vm.envOr("STELLAR_STORE", SEPOLIA_STORE);
        require(storeAddress.code.length > 0, "STELLAR_STORE has no code on this chain");
        StellarStore store = StellarStore(storeAddress);
        address deployer = vm.addr(deployerKey);
        require(store.hasRole(store.DEFAULT_ADMIN_ROLE(), deployer), "deployer is not the StellarStore admin");
        bytes32 gameRole = store.GAME_ROLE();

        vm.startBroadcast(deployerKey);
        forge = new StellarForge(IStellarStore(storeAddress), deployer); // tx 1
        store.grantRole(gameRole, address(forge)); // tx 2
        vm.stopBroadcast();

        console.log("Deployer      :", deployer);
        console.log("StellarStore  :", storeAddress);
        console.log("StellarForge  :", address(forge));
    }
}
