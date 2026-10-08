# Stellar Store — ERC-1155 game items paid in $VLAD (Sepolia)

Part of **Stellar — personal Web3 suite on Ethereum Sepolia** (a portfolio brand, not the XLM network).

`StellarStore` is an ERC-1155 contract that sells game items for $VLAD ("Vladimir", 18 decimals).
The items are used in [Stellar-Arena](https://github.com/VladimirRadev/Stellar-Arena): the Arena burns an item
when a player uses it in a run and mints an Arena Trophy when a player wins.

| ID | Item | Price | Buyable | Effect in the Arena |
|---:|---|---:|:---:|---|
| 1 | Guardian Sword | 25 VLAD | yes | +10 attack roll |
| 2 | Guardian Shield | 40 VLAD | yes | 50% stake refund on loss |
| 3 | Arena Trophy | — | no | Awarded for winning an Arena run |

## Architecture

```
player ──approve(store, cost)──▶ VLAD (ERC-20, deployed by Stellar-Faucet)
player ──buy(id, amount)───────▶ StellarStore ──transferFrom(player → treasury, price × amount)──▶ VLAD
                                       │
                                       └── mints `amount` of item `id` to the player (ERC-1155)
Arena (GAME_ROLE) ──consume(player, id, n)──▶ StellarStore  (burns items used in a run)
Arena (GAME_ROLE) ──award(player, TROPHY, 1)─▶ StellarStore  (mints a trophy for a win)
```

- `src/StellarStore.sol` — the shop: `ERC1155` + `AccessControl` (OpenZeppelin v5.4.0), payment through `SafeERC20`.
- `src/interfaces/IStellarStore.sol` — the interface the Arena repo copies (`SWORD/SHIELD/TROPHY`, `balanceOf`,
  `consume`, `award`).
- `src/interfaces/IVladToken.sol` — the shared $VLAD interface (the token itself lives in Stellar-Faucet).
- `web/public/metadata/` — OpenSea-style metadata `1.json`–`3.json` and the item images `1.svg`–`3.svg`.
  `uri(id)` returns `<baseUri><id>.json`, with base URI `https://vladimirradev.github.io/Stellar-Store/metadata/`.

## Roles

| Role | Holder | Can call |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | deployer | `setItem`, `setTreasury`, `setBaseUri`, `grantRole` / `revokeRole` |
| `GAME_ROLE` | Stellar-Arena contract | `consume` (burn a player's items), `award` (mint items, e.g. trophies) |

## Economy

- Every purchase sends `price × amount` VLAD straight from the buyer to `treasury`; the store itself never holds VLAD.
- At deploy time `treasury` is the deployer. The Stellar-Arena deploy script (in the Arena repo) then runs, from the
  store admin account:
  1. `grantRole(GAME_ROLE, arena)` — lets the Arena burn and award items;
  2. `setTreasury(arena)` — from then on **100% of store proceeds go to the Arena prize pool**.

## Deploy

```shell
# .env* files are git-ignored; export the variables in your shell or load them from a local .env
export PRIVATE_KEY=0x...          # deployer key — never commit it
export VLAD_TOKEN=0x...           # deployed $VLAD address on Sepolia (from Stellar-Faucet)
export SEPOLIA_RPC_URL=https://... # any Sepolia RPC endpoint
forge script script/Deploy.s.sol --rpc-url "$SEPOLIA_RPC_URL" --broadcast
```

The script checks that `VLAD_TOKEN` has code on the target chain, then deploys `StellarStore` in one transaction.

## Addresses (Ethereum Sepolia, chain ID 11155111)

| Contract | Address |
|---|---|
| VLAD token | TODO |
| StellarStore | TODO |

## Develop

```shell
git clone --recurse-submodules https://github.com/VladimirRadev/Stellar-Store
forge build
forge test
forge fmt --check
```

## Part of the Stellar suite

| Repo | Site |
|---|---|
| [Stellar-Faucet](https://github.com/VladimirRadev/Stellar-Faucet) | https://vladimirradev.github.io/Stellar-Faucet/ |
| [Stellar-LP-Staking](https://github.com/VladimirRadev/Stellar-LP-Staking) | https://vladimirradev.github.io/Stellar-LP-Staking/ |
| [Stellar-Bank](https://github.com/VladimirRadev/Stellar-Bank) | https://vladimirradev.github.io/Stellar-Bank/ |
| **[Stellar-Store](https://github.com/VladimirRadev/Stellar-Store)** | https://vladimirradev.github.io/Stellar-Store/ |
| [Stellar-Arena](https://github.com/VladimirRadev/Stellar-Arena) | https://vladimirradev.github.io/Stellar-Arena/ |
