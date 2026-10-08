import type { Address } from 'viem'
import { iVladTokenAbi, stellarStoreAbi } from '../abi'
import { CHAIN_ID, addresses } from '../config/addresses'
import type { ErrorMessages } from '../shell/errors'
import { formatToken, isConfiguredAddress, truncateAddress } from '../shell/format'
import { getSite } from '../shell/sites'

/** True once both contracts have real Sepolia addresses; until then every on-chain read is off. */
export const DEPLOYED = isConfiguredAddress(addresses.vladToken) && isConfiguredAddress(addresses.store)

/** The live Stellar Arena site (GitHub Pages). */
export const ARENA_URL = getSite('arena').url

/** True when `address` is the deployed StellarArena contract (the store's treasury once the Arena is wired). */
export const isArenaAddress = (address: Address | undefined) =>
  !!address && isConfiguredAddress(addresses.arena) && address.toLowerCase() === addresses.arena.toLowerCase()

export const store = { address: addresses.store, abi: stellarStoreAbi, chainId: CHAIN_ID } as const
export const token = { address: addresses.vladToken, abi: iVladTokenAbi, chainId: CHAIN_ID } as const

export type CatalogItem = {
  id: bigint
  /** Name, price and buyable flag the contract sets in its constructor (shown until on-chain data loads). */
  defaultName: string
  defaultPrice: bigint
  defaultBuyable: boolean
  kind: string
  effect: string
}

/** The three ERC-1155 ids StellarStore knows about (SWORD = 1, SHIELD = 2, TROPHY = 3). */
export const CATALOG: readonly CatalogItem[] = [
  {
    id: 1n,
    defaultName: 'Guardian Sword',
    defaultPrice: 25n * 10n ** 18n,
    defaultBuyable: true,
    kind: 'Weapon',
    effect: '+10 to your attack roll in the Arena.',
  },
  {
    id: 2n,
    defaultName: 'Guardian Shield',
    defaultPrice: 40n * 10n ** 18n,
    defaultBuyable: true,
    kind: 'Armor',
    effect: '50% of your stake back if you lose.',
  },
  {
    id: 3n,
    defaultName: 'Arena Trophy',
    defaultPrice: 0n,
    defaultBuyable: false,
    kind: 'Trophy',
    effect: 'Not for sale: awarded for Arena wins.',
  },
]

export const ITEM_IDS = CATALOG.map((item) => item.id)

/** Item image served from GitHub Pages next to the metadata JSON (web/public/metadata/<id>.svg). */
export const itemArt = (id: bigint) => `${import.meta.env.BASE_URL}metadata/${id}.svg`

/** Absolute URL of an item's ERC-1155 metadata JSON (what uri(id) returns on-chain). */
export const metadataUrl = (id: bigint) =>
  `${window.location.origin}${import.meta.env.BASE_URL}metadata/${id}.json`

/** Readable sentences for the custom errors buy() and approve() can revert with. */
export const STORE_ERRORS: ErrorMessages = {
  ItemNotBuyable: () => 'This item is not for sale. Arena Trophies are only awarded for Arena wins.',
  ZeroAmount: () => 'Choose a quantity of at least 1.',
  ERC20InsufficientAllowance: ([, allowance, needed]) =>
    `Allowance too low: you approved ${formatToken(allowance as bigint)} VLAD but this purchase needs ${formatToken(needed as bigint)} VLAD. Approve first.`,
  ERC20InsufficientBalance: ([, balance, needed]) =>
    `Not enough VLAD: you have ${formatToken(balance as bigint)} VLAD and this purchase costs ${formatToken(needed as bigint)} VLAD.`,
  ERC1155InvalidReceiver: ([receiver]) =>
    `${truncateAddress(String(receiver))} cannot receive ERC-1155 items (a contract without onERC1155Received).`,
}
