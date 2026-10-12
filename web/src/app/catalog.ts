import type { Address } from 'viem'
import { iVladTokenAbi, stellarForgeAbi, stellarStoreAbi } from '../abi'
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

/** True once StellarForge has a real Sepolia address (the Forge tab switches its reads and button on). */
export const FORGE_DEPLOYED = DEPLOYED && isConfiguredAddress(addresses.stellarForge)

export const store = { address: addresses.store, abi: stellarStoreAbi, chainId: CHAIN_ID } as const
export const token = { address: addresses.vladToken, abi: iVladTokenAbi, chainId: CHAIN_ID } as const
export const forge = { address: addresses.stellarForge, abi: stellarForgeAbi, chainId: CHAIN_ID } as const

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

/** Quantity plus item name for messages: "1 Guardian Sword", "2 Guardian Swords", "4 Arena Trophies". */
export function countOf(n: bigint | number, name: string): string {
  if (BigInt(n) === 1n) return `1 ${name}`
  const plural = /[^aeiou]y$/i.test(name)
    ? `${name.slice(0, -1)}ies`
    : /(s|x|z|ch|sh)$/i.test(name)
      ? `${name}es`
      : `${name}s`
  return `${n} ${plural}`
}

/** Readable sentences for the custom errors buy() can revert with (the allowance errors cover a skipped approval). */
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

/** Readable sentences for the custom errors StellarForge.redeem() can revert with. */
export const FORGE_ERRORS: ErrorMessages = {
  InsufficientTrophies: ([have, need]) =>
    `Not enough trophies: you have ${String(have)} and this redemption needs ${String(need)}.`,
  NotRedeemable: ([id]) => `Item #${String(id)} cannot be redeemed at the Forge right now.`,
  ZeroAmount: () => 'Choose a quantity of at least 1.',
  AccessControlUnauthorizedAccount: () =>
    'The Forge does not hold the Store game role yet, so it cannot burn trophies. Try again after the role is granted.',
  ERC1155InvalidReceiver: ([receiver]) =>
    `${truncateAddress(String(receiver))} cannot receive ERC-1155 items (a contract without onERC1155Received).`,
}
