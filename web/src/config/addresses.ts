import type { Address } from 'viem'

/** Ethereum Sepolia. */
export const CHAIN_ID = 11155111 as const

/**
 * Deployed contract addresses on Sepolia.
 * The zero address is a placeholder: the UI shows a "not deployed yet" state for it.
 * vladToken comes from Stellar-Faucet (deployments/sepolia.json); store is this repo's StellarStore.
 */
export const addresses = {
  vladToken: '0x0000000000000000000000000000000000000000',
  store: '0x0000000000000000000000000000000000000000',
} as const satisfies Record<string, Address>

/** Contracts listed in the footer, with Blockscout links. */
export const footerContracts: readonly { label: string; address: Address }[] = [
  { label: 'VladToken ($VLAD)', address: addresses.vladToken },
  { label: 'StellarStore (ERC-1155)', address: addresses.store },
]
