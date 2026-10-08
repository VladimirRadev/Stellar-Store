// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors, IERC1155Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {StellarStore} from "../src/StellarStore.sol";
import {IStellarStore} from "../src/interfaces/IStellarStore.sol";
import {MockVlad} from "./mocks/MockVlad.sol";

/// @dev A contract that does not implement onERC1155Received, so ERC-1155 mints to it must revert.
contract NonReceiverBuyer {
    function buy(StellarStore store, IERC20 vlad, uint256 id, uint256 amount) external {
        vlad.approve(address(store), type(uint256).max);
        store.buy(id, amount);
    }
}

contract StellarStoreTest is Test {
    string internal constant BASE_URI = "https://vladimirradev.github.io/Stellar-Store/metadata/";

    MockVlad internal vlad;
    StellarStore internal store;
    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal arena = makeAddr("arena");
    address internal alice = makeAddr("alice");
    address internal mallory = makeAddr("mallory");

    event Purchased(address indexed buyer, uint256 indexed id, uint256 amount, uint256 cost);
    event Consumed(address indexed owner, uint256 indexed id, uint256 amount, address indexed by);
    event Awarded(address indexed to, uint256 indexed id, uint256 amount, address indexed by);

    function setUp() public {
        vlad = new MockVlad();
        vm.startPrank(admin);
        store = new StellarStore(IERC20(address(vlad)), treasury, BASE_URI);
        store.grantRole(store.GAME_ROLE(), arena);
        vm.stopPrank();
        vlad.mint(alice, 1_000e18);
    }

    function test_BuyPaysTreasuryMintsAndEmits() public {
        uint256 cost = 2 * 25e18; // 2 swords at 25 VLAD each
        vm.startPrank(alice);
        vlad.approve(address(store), cost);
        vm.expectEmit(true, true, false, true, address(store));
        emit Purchased(alice, store.SWORD(), 2, cost);
        store.buy(store.SWORD(), 2);
        vm.stopPrank();

        assertEq(vlad.balanceOf(treasury), cost);
        assertEq(vlad.balanceOf(alice), 1_000e18 - cost);
        assertEq(vlad.balanceOf(address(store)), 0);
        assertEq(store.balanceOf(alice, store.SWORD()), 2);
    }

    function test_BuyTrophyRevertsNotBuyable() public {
        uint256 trophy = store.TROPHY();
        uint256 sword = store.SWORD();
        vm.startPrank(alice);
        vlad.approve(address(store), type(uint256).max);
        vm.expectRevert(StellarStore.ItemNotBuyable.selector);
        store.buy(trophy, 1);
        vm.expectRevert(StellarStore.ZeroAmount.selector);
        store.buy(sword, 0);
        vm.stopPrank();
    }

    function test_BuyWithoutAllowanceReverts() public {
        uint256 shield = store.SHIELD();
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(store), 0, 40e18)
        );
        vm.prank(alice);
        store.buy(shield, 1);
        assertEq(store.balanceOf(alice, shield), 0);
    }

    function test_ConsumeByGameRoleBurnsOthersRevert() public {
        uint256 sword = store.SWORD();
        vm.prank(arena);
        store.award(alice, sword, 3);

        bytes32 gameRole = store.GAME_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, mallory, gameRole)
        );
        vm.prank(mallory);
        store.consume(alice, sword, 1);

        // Called through IStellarStore to prove the published interface matches the contract ABI.
        vm.expectEmit(true, true, true, true, address(store));
        emit Consumed(alice, sword, 2, arena);
        vm.prank(arena);
        IStellarStore(address(store)).consume(alice, sword, 2);
        assertEq(store.balanceOf(alice, sword), 1);
    }

    function test_AwardByGameRoleMintsOthersRevert() public {
        uint256 trophy = store.TROPHY();
        bytes32 gameRole = store.GAME_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, mallory, gameRole)
        );
        vm.prank(mallory);
        store.award(mallory, trophy, 1);

        vm.expectEmit(true, true, true, true, address(store));
        emit Awarded(alice, trophy, 1, arena);
        vm.prank(arena);
        IStellarStore(address(store)).award(alice, trophy, 1);
        assertEq(IStellarStore(address(store)).balanceOf(alice, trophy), 1);
    }

    function test_UriIsBasePlusIdJson() public {
        assertEq(store.uri(1), string.concat(BASE_URI, "1.json"));
        assertEq(store.uri(3), string.concat(BASE_URI, "3.json"));
        vm.prank(admin);
        store.setBaseUri("ipfs://cid/");
        assertEq(store.uri(2), "ipfs://cid/2.json");
    }

    function test_SetItemAndTreasuryOnlyAdmin() public {
        bytes32 adminRole = store.DEFAULT_ADMIN_ROLE();
        bytes memory unauthorized =
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, mallory, adminRole);

        vm.startPrank(mallory);
        vm.expectRevert(unauthorized);
        store.setItem(3, 1e18, true, "Cheap Trophy");
        vm.expectRevert(unauthorized);
        store.setTreasury(mallory);
        vm.expectRevert(unauthorized);
        store.setBaseUri("https://evil.example/");
        vm.stopPrank();

        vm.startPrank(admin);
        store.setItem(1, 30e18, true, "Guardian Sword II");
        store.setTreasury(arena);
        vm.expectRevert(StellarStore.ZeroAddress.selector);
        store.setTreasury(address(0));
        vm.stopPrank();

        (uint256 price, bool buyable, string memory name) = store.items(1);
        assertEq(price, 30e18);
        assertTrue(buyable);
        assertEq(name, "Guardian Sword II");
        assertEq(store.treasury(), arena);
    }

    function test_BuyFromNonReceiverContractReverts() public {
        NonReceiverBuyer buyer = new NonReceiverBuyer();
        vlad.mint(address(buyer), 100e18);
        uint256 sword = store.SWORD();
        vm.expectRevert(abi.encodeWithSelector(IERC1155Errors.ERC1155InvalidReceiver.selector, address(buyer)));
        buyer.buy(store, IERC20(address(vlad)), sword, 1);
        // The whole purchase reverted, so no VLAD left the buyer.
        assertEq(vlad.balanceOf(address(buyer)), 100e18);
        assertEq(vlad.balanceOf(treasury), 0);
    }
}
