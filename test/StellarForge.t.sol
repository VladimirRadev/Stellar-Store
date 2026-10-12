// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {StellarStore} from "../src/StellarStore.sol";
import {StellarForge} from "../src/StellarForge.sol";
import {IStellarStore} from "../src/interfaces/IStellarStore.sol";
import {MockVlad} from "./mocks/MockVlad.sol";

contract StellarForgeTest is Test {
    string internal constant BASE_URI = "https://vladimirradev.github.io/Stellar-Store/metadata/";
    uint256 internal constant SWORD = 1;
    uint256 internal constant SHIELD = 2;
    uint256 internal constant TROPHY = 3;

    StellarStore internal store;
    StellarForge internal forge;
    address internal admin = makeAddr("admin");
    address internal arena = makeAddr("arena");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    event Redeemed(address indexed player, uint256 indexed itemId, uint256 amount, uint256 trophiesBurned);
    event TrophyPriceSet(uint256 indexed itemId, uint256 trophies);

    function setUp() public {
        MockVlad vlad = new MockVlad();
        vm.startPrank(admin);
        store = new StellarStore(IERC20(address(vlad)), admin, BASE_URI);
        forge = new StellarForge(IStellarStore(address(store)), admin);
        store.grantRole(store.GAME_ROLE(), arena);
        store.grantRole(store.GAME_ROLE(), address(forge));
        vm.stopPrank();
    }

    /// @dev Mints `n` trophies to `player` the way the Arena does after a won run.
    function _winTrophies(address player, uint256 n) internal {
        vm.prank(arena);
        store.award(player, TROPHY, n);
    }

    function test_ConstructorPricesAndQuote() public view {
        assertEq(forge.owner(), admin);
        assertEq(address(forge.store()), address(store));
        assertEq(forge.trophyPrice(SWORD), 2);
        assertEq(forge.trophyPrice(SHIELD), 3);
        assertEq(forge.trophyPrice(TROPHY), 0);
        assertEq(forge.quote(SHIELD, 4), 12);
        assertEq(forge.quote(99, 4), 0);
    }

    function test_RedeemOneSwordBurnsTwoTrophies() public {
        _winTrophies(alice, 5);
        vm.prank(alice);
        forge.redeem(SWORD, 1);
        assertEq(store.balanceOf(alice, TROPHY), 3);
        assertEq(store.balanceOf(alice, SWORD), 1);
        assertEq(store.balanceOf(alice, SHIELD), 0);
    }

    function test_RedeemTwoShieldsBurnsSixTrophies() public {
        _winTrophies(alice, 6);
        vm.prank(alice);
        forge.redeem(SHIELD, 2);
        assertEq(store.balanceOf(alice, TROPHY), 0);
        assertEq(store.balanceOf(alice, SHIELD), 2);
    }

    function test_MixedRedeemsLeaveTheRightRemainder() public {
        _winTrophies(alice, 10);
        vm.startPrank(alice);
        forge.redeem(SWORD, 2); // 4 trophies
        forge.redeem(SHIELD, 1); // 3 trophies
        vm.stopPrank();
        assertEq(store.balanceOf(alice, TROPHY), 3);
        assertEq(store.balanceOf(alice, SWORD), 2);
        assertEq(store.balanceOf(alice, SHIELD), 1);
    }

    function test_InsufficientTrophiesReverts() public {
        _winTrophies(alice, 4);
        vm.expectRevert(abi.encodeWithSelector(StellarForge.InsufficientTrophies.selector, 4, 6));
        vm.prank(alice);
        forge.redeem(SHIELD, 2);

        // Bob cannot spend Alice's trophies: the Forge only reads and burns the caller's balance.
        vm.expectRevert(abi.encodeWithSelector(StellarForge.InsufficientTrophies.selector, 0, 2));
        vm.prank(bob);
        forge.redeem(SWORD, 1);

        assertEq(store.balanceOf(alice, TROPHY), 4);
        assertEq(store.balanceOf(alice, SHIELD), 0);
    }

    function test_UnknownItemAndTrophyRevertNotRedeemable() public {
        _winTrophies(alice, 10);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(StellarForge.NotRedeemable.selector, 99));
        forge.redeem(99, 1);
        vm.expectRevert(abi.encodeWithSelector(StellarForge.NotRedeemable.selector, TROPHY));
        forge.redeem(TROPHY, 1);
        vm.stopPrank();
        assertEq(store.balanceOf(alice, TROPHY), 10);
    }

    function test_ZeroAmountReverts() public {
        _winTrophies(alice, 2);
        vm.expectRevert(StellarForge.ZeroAmount.selector);
        vm.prank(alice);
        forge.redeem(SWORD, 0);
    }

    function test_RedeemWithoutGameRoleReverts() public {
        StellarForge unwired = new StellarForge(IStellarStore(address(store)), admin);
        _winTrophies(alice, 2);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, address(unwired), store.GAME_ROLE()
            )
        );
        vm.prank(alice);
        unwired.redeem(SWORD, 1);
        assertEq(store.balanceOf(alice, TROPHY), 2);
    }

    function test_SetTrophyPriceOnlyOwnerRejectsTrophyZeroDisables() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        forge.setTrophyPrice(SWORD, 1);

        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(StellarForge.NotRedeemable.selector, TROPHY));
        forge.setTrophyPrice(TROPHY, 1);
        vm.expectEmit(true, false, false, true, address(forge));
        emit TrophyPriceSet(SWORD, 0);
        forge.setTrophyPrice(SWORD, 0);
        forge.setTrophyPrice(SHIELD, 5);
        vm.stopPrank();

        _winTrophies(alice, 5);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(StellarForge.NotRedeemable.selector, SWORD));
        forge.redeem(SWORD, 1);
        forge.redeem(SHIELD, 1);
        vm.stopPrank();
        assertEq(store.balanceOf(alice, TROPHY), 0);
        assertEq(store.balanceOf(alice, SHIELD), 1);
    }

    function test_RedeemEmitsRedeemed() public {
        _winTrophies(alice, 9);
        vm.expectEmit(true, true, false, true, address(forge));
        emit Redeemed(alice, SHIELD, 3, 9);
        vm.prank(alice);
        forge.redeem(SHIELD, 3);
    }

    function testFuzz_RedeemBurnsExactlyPriceTimesAmount(uint256 amount, uint256 won, bool shield) public {
        uint256 itemId = shield ? SHIELD : SWORD;
        amount = bound(amount, 1, 1_000);
        uint256 cost = forge.trophyPrice(itemId) * amount;
        won = bound(won, cost, cost + 1_000);
        _winTrophies(alice, won);
        vm.prank(alice);
        forge.redeem(itemId, amount);
        assertEq(store.balanceOf(alice, TROPHY), won - cost);
        assertEq(store.balanceOf(alice, itemId), amount);
    }
}
