import type { Address } from 'viem'
import { useConnection, useReadContract, useReadContracts } from 'wagmi'
import { addresses } from '../config/addresses'
import { CATALOG, DEPLOYED, ITEM_IDS, store, token, type CatalogItem } from './catalog'

/** One item with on-chain values where available and constructor defaults otherwise. */
export type StoreItem = CatalogItem & { name: string; price: bigint; buyable: boolean }

export type UserData = {
  vladBalance: bigint | undefined
  allowance: bigint | undefined
  /** ERC-1155 balance per item id, in CATALOG order. */
  counts: readonly bigint[] | undefined
  loading: boolean
}

/** Every read the store page needs. Each read passes chainId: CHAIN_ID (via `store` / `token`). */
export function useStoreData() {
  const { address } = useConnection()

  const globals = useReadContracts({
    contracts: [
      ...ITEM_IDS.map((id) => ({ ...store, functionName: 'items', args: [id] }) as const),
      { ...store, functionName: 'treasury' },
    ],
    query: { enabled: DEPLOYED },
  })

  const items: StoreItem[] = CATALOG.map((item, i) => {
    const onChain = globals.data?.[i]?.result as readonly [bigint, boolean, string] | undefined
    return {
      ...item,
      price: onChain?.[0] ?? item.defaultPrice,
      buyable: onChain?.[1] ?? item.defaultBuyable,
      name: onChain?.[2] || item.defaultName,
    }
  })
  const treasury = globals.data?.[ITEM_IDS.length]?.result as Address | undefined

  const prizePool = useReadContract({
    ...token,
    functionName: 'balanceOf',
    args: treasury ? [treasury] : undefined,
    query: { enabled: DEPLOYED && !!treasury },
  })

  const userReads = useReadContracts({
    contracts: address
      ? [
          { ...token, functionName: 'balanceOf', args: [address] },
          { ...token, functionName: 'allowance', args: [address, addresses.store] },
          {
            ...store,
            functionName: 'balanceOfBatch',
            args: [ITEM_IDS.map(() => address), ITEM_IDS],
          },
        ]
      : [],
    query: { enabled: DEPLOYED && !!address },
  })

  const user: UserData = {
    vladBalance: userReads.data?.[0]?.result as bigint | undefined,
    allowance: userReads.data?.[1]?.result as bigint | undefined,
    counts: userReads.data?.[2]?.result as readonly bigint[] | undefined,
    loading: DEPLOYED && !!address && userReads.isLoading,
  }

  return {
    items,
    itemsLoading: DEPLOYED && globals.isLoading,
    treasury,
    prizePool: prizePool.data,
    prizePoolLoading: DEPLOYED && (globals.isLoading || prizePool.isLoading),
    user,
  }
}

export type StoreData = ReturnType<typeof useStoreData>
