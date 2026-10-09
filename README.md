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
| `GAME_ROLE` | StellarArena and StellarArcade (both from Stellar-Arena) | `consume` (burn a player's items), `award` (mint items, e.g. trophies) |

## Economy

- Every purchase sends `price × amount` VLAD straight from the buyer to `treasury`; the store itself never holds VLAD.
- At deploy time `treasury` is the deployer. The Stellar-Arena deploy script (in the Arena repo) then runs, from the
  store admin account:
  1. `grantRole(GAME_ROLE, arena)` — lets the Arena burn and award items;
  2. `setTreasury(arena)` — from then on **100% of store proceeds go to the Arena prize pool**.

  On Sepolia both calls are done: `treasury()` returns the StellarArena address
  `0xE79302DAebc28297745afC206553afBeD9d04d60`, which also holds `GAME_ROLE`.

## Deploy

The deploy script sends exactly one transaction: `new StellarStore(vlad, deployer, baseUri)`.
It reads the key from the `PRIVATE_KEY` environment variable (no key is ever stored in this repo) and the token
address from `VLAD_TOKEN`, and it stops if `VLAD_TOKEN` has no contract code on the target chain.

```shell
# PRIVATE_KEY lives in an env file outside the repo (.env* is git-ignored anyway)
set -a; source /path/to/deployer.env; set +a
VLAD_TOKEN=0x49ba857d553ef219B144b200F41acaf8CB6768E9 forge script script/Deploy.s.sol \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --broadcast --slow --skip-simulation -vvv
```

Always deploy with `--skip-simulation`. Sepolia's current fork charges far more gas for contract creation than
forge's local simulation, which uses the Cancun rules from `foundry.toml`: the `StellarStore` creation used
14,255,966 gas on Sepolia. Without the flag, forge sets each gas limit to its local estimate × 1.3 and the
transaction runs out of gas. With `--skip-simulation` (together with `--slow`), forge asks the Sepolia node for a
gas estimate right before it sends the transaction.

If the deployer account has an EIP-7702 delegation, the node accepts only one unconfirmed transaction at a time.
If a send is rejected with "in-flight transaction limit reached for delegated accounts", wait about 20 seconds
for the previous transaction to confirm, then rerun the same command with `--resume`; forge then sends only the
transactions that are still missing.

Verify without an Etherscan key, through Sourcify and Blockscout:

```shell
ARGS=$(cast abi-encode "constructor(address,address,string)" <vladToken> <deployer> \
  "https://vladimirradev.github.io/Stellar-Store/metadata/")
forge verify-contract <store> src/StellarStore.sol:StellarStore --chain 11155111 \
  --verifier sourcify --constructor-args $ARGS --watch
forge verify-contract <store> src/StellarStore.sol:StellarStore --chain 11155111 \
  --verifier blockscout --verifier-url https://eth-sepolia.blockscout.com/api/ --constructor-args $ARGS --watch
```

The deployed addresses, transaction hash, gas used and verification results are recorded in
`deployments/sepolia.json`.

## Web app

Live: **https://vladimirradev.github.io/Stellar-Store/**

A React 19 + wagmi 3 + viem single page in `web/`, built on the shared Stellar scaffold (`web/src/shell/` is
byte-identical across the six repos; see `web/SCAFFOLD.md`). MetaMask (injected wallet) only, Sepolia only.

- **Shop** — reads `items(id)` for ids 1–3 (price, buyable, name), a quantity stepper with the total cost,
  then a two-step flow: `approve(store, total)` on VLAD when the allowance is too low, then `buy(id, amount)`.
  Custom errors (`ItemNotBuyable`, `ZeroAmount`, ERC-20 allowance and balance errors) are decoded before the
  wallet opens. A wallet with less VLAD than the total gets a link to the Faucet.
- **Inventory** — your balances for ids 1–3 via one `balanceOfBatch` call, their value at current store prices,
  and a link to play in the Arena.
- The treasury address (the Arena prize pool) and its VLAD balance are read on-chain and linked to Blockscout.
- Item metadata and art are static files in `web/public/metadata/`, published with the site.

The contract addresses live in `web/src/config/addresses.ts`. If an address there is the zero address, the page
shows a "not deployed yet" banner and switches every on-chain read off. `.github/workflows/pages.yml` builds `web/` and deploys it on every push to `main`.

```shell
cd web
npm install
npm run sync-abi   # after `forge build` in the repo root
npm run dev        # http://localhost:5173/Stellar-Store/
npm run build      # tsc -b && vite build, output in web/dist
```

## Addresses (Ethereum Sepolia, chain ID 11155111)

| Contract | Address | Notes |
|---|---|---|
| StellarStore (ERC-1155) | [`0xc1F24EF5887bD340E0d992e8557A4b6E977f151b`](https://eth-sepolia.blockscout.com/address/0xc1F24EF5887bD340E0d992e8557A4b6E977f151b) | verified on Sourcify (exact match) and Blockscout |
| VLAD token ($VLAD) | [`0x49ba857d553ef219B144b200F41acaf8CB6768E9`](https://eth-sepolia.blockscout.com/address/0x49ba857d553ef219B144b200F41acaf8CB6768E9) | deployed by [Stellar-Faucet](https://github.com/VladimirRadev/Stellar-Faucet) |
| StellarArena (treasury / prize pool) | [`0xE79302DAebc28297745afC206553afBeD9d04d60`](https://eth-sepolia.blockscout.com/address/0xE79302DAebc28297745afC206553afBeD9d04d60) | deployed by [Stellar-Arena](https://github.com/VladimirRadev/Stellar-Arena); holds `GAME_ROLE` and is the store's `treasury` |
| StellarArcade (29 cabinets) | [`0x64dc8Df451Da01ab2460584f04C29D2df517ac4b`](https://eth-sepolia.blockscout.com/address/0x64dc8Df451Da01ab2460584f04C29D2df517ac4b) | deployed by [Stellar-Arena](https://github.com/VladimirRadev/Stellar-Arena); holds `GAME_ROLE` (granted in its deploy, block 11,876,094) |
| Deployer and admin | [`0xEb0243ea72CB24eFb7128Ee7aca314C080b600c4`](https://eth-sepolia.blockscout.com/address/0xEb0243ea72CB24eFb7128Ee7aca314C080b600c4) | holds `DEFAULT_ADMIN_ROLE` |

Deployment transaction:
[`0x9d534be1…659eb2`](https://eth-sepolia.blockscout.com/tx/0x9d534be1e7ae7a66f091fdf2e72382dd2d15532903a81bb41e6f80eab9659eb2)
(block 11,870,381).

## Develop

```shell
git clone --recurse-submodules https://github.com/VladimirRadev/Stellar-Store
forge build
forge test
forge fmt --check
```

## Smoke tests (2026-10-09)

End-to-end run on Ethereum Sepolia on 2026-10-09 from the deployer `0xEb0243ea72CB24eFb7128Ee7aca314C080b600c4` (an EIP-7702 delegated EOA), with `smoke.sh` (19 steps across the whole suite, one transaction at a time, each waiting for its receipt). After every transaction the script compared balances, reserves and events at the transaction's block with the block before it; "ok" means every such assertion passed. Step numbers are the suite-wide order. Rows for this repo (step 14 is the VLAD approval for the store):

| Step | Function | Result | Tx (Blockscout) | Gas used |
|---|---|---|---|---|
| 14 | `vlad.approve(store, 25e18)` | ok | [`0xd7dfccd6…b011cb`](https://eth-sepolia.blockscout.com/tx/0xd7dfccd6b153c0a820606049d812516cae034b3790f075e7300fead6c6b011cb) | 128328 |
| 15 | `store.buy(1, 1)` | ok | [`0x25170fc4…af5f1a`](https://eth-sepolia.blockscout.com/tx/0x25170fc47ef8e3bde0ea2b10a34eae68649ca7e20405737642dc96a819af5f1a) | 175113 |

- Step 15 store: bought 1 Guardian Sword for 25 VLAD, paid to treasury 0xE79302DAebc28297745afC206553afBeD9d04d60

## Part of the Stellar suite

| App | Repository | Live site |
|---|---|---|
| Faucet ($VLAD token) | [Stellar-Faucet](https://github.com/VladimirRadev/Stellar-Faucet) | https://vladimirradev.github.io/Stellar-Faucet/ |
| Swap & LP Staking | [Stellar-LP-Staking](https://github.com/VladimirRadev/Stellar-LP-Staking) | https://vladimirradev.github.io/Stellar-LP-Staking/ |
| Bank | [Stellar-Bank](https://github.com/VladimirRadev/Stellar-Bank) | https://vladimirradev.github.io/Stellar-Bank/ |
| Store | **[Stellar-Store](https://github.com/VladimirRadev/Stellar-Store)** (this repo) | https://vladimirradev.github.io/Stellar-Store/ |
| Arena + Arcade | [Stellar-Arena](https://github.com/VladimirRadev/Stellar-Arena) | https://vladimirradev.github.io/Stellar-Arena/ |
| Stellargon (prediction market) | [Stellargon](https://github.com/VladimirRadev/Stellargon) | https://vladimirradev.github.io/Stellargon/ |

Stellar is a personal portfolio brand, unrelated to the Stellar (XLM) network.
