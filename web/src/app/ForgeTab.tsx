import { useState } from 'react'
import type { Hash } from 'viem'
import { useConnection, useReadContracts, useSwitchChain } from 'wagmi'
import { stellarForgeAbi } from '../abi'
import { CHAIN_ID, addresses } from '../config/addresses'
import { CopyButton } from '../shell/CopyButton'
import { describeError } from '../shell/errors'
import { explorerAddressUrl, explorerTxUrl, truncateAddress } from '../shell/format'
import { ArrowIcon, CheckIcon, ExternalIcon, Spinner } from '../shell/icons'
import { StatTile } from '../shell/StatTile'
import { TxButton } from '../shell/TxButton'
import { ConnectButton } from '../shell/WalletButton'
import { ARENA_URL, FORGE_DEPLOYED, FORGE_ERRORS, forge, itemArt } from './catalog'
import { QuantityStepper } from './ShopTab'
import type { StoreData, StoreItem } from './useStoreData'

/** Trophies per item that StellarForge sets in its constructor (shown until the contract is deployed and read). */
const DEFAULT_TROPHY_PRICE: Record<string, bigint> = { '1': 2n, '2': 3n }
const TROPHY_INDEX = 2 // data.user.counts follows CATALOG order: sword, shield, trophy

export function ForgeTab({ data, onOpenInventory }: { data: StoreData; onOpenInventory: () => void }) {
  const { isConnected } = useConnection()
  const forgeItems = data.items.filter((item) => item.id.toString() in DEFAULT_TROPHY_PRICE)

  const prices = useReadContracts({
    contracts: forgeItems.map((item) => ({ ...forge, functionName: 'trophyPrice', args: [item.id] }) as const),
    query: { enabled: FORGE_DEPLOYED },
  })
  const priceOf = (item: StoreItem, i: number) =>
    (prices.data?.[i]?.result as bigint | undefined) ?? DEFAULT_TROPHY_PRICE[item.id.toString()]
  const trophies = data.user.counts?.[TROPHY_INDEX]

  return (
    <div>
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold sm:text-3xl">Forge trophies into gear</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
          Every Arena Trophy you win stays in your wallet until you redeem it here. There is no approval step: the
          Forge holds the Store&apos;s game role, so it burns your trophies and mints the item in the same transaction.
        </p>
      </div>

      {!FORGE_DEPLOYED ? (
        <div className="mt-6 rounded-2xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm text-warning">
          <p className="font-semibold">The Forge is not deployed yet</p>
          <p className="mt-1 leading-relaxed">
            The StellarForge contract has no Sepolia address yet, so redeeming is switched off. Keep your trophies:
            they will be redeemable as soon as it goes live.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile
          label="Your trophies"
          value={isConnected ? (trophies !== undefined ? trophies.toString() : '—') : '—'}
          loading={isConnected && data.user.loading}
          hint={isConnected ? 'Arena + Arcade wins' : 'connect a wallet'}
          highlight
        />
        <StatTile
          label="Forge rates"
          value={forgeItems.map((item, i) => priceOf(item, i).toString()).join(' / ')}
          unit="trophies"
          loading={FORGE_DEPLOYED && prices.isLoading}
          hint="sword / shield, each"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {forgeItems.map((item, i) => (
          <ForgeCard
            key={item.id.toString()}
            item={item}
            price={priceOf(item, i)}
            trophies={trophies}
            trophiesLoading={data.user.loading}
            owned={data.user.counts?.[i]}
            onOpenInventory={onOpenInventory}
          />
        ))}
      </div>

      {FORGE_DEPLOYED ? (
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          StellarForge
          <a
            className="link inline-flex items-center gap-1 font-mono"
            href={explorerAddressUrl(addresses.stellarForge)}
            target="_blank"
            rel="noreferrer"
          >
            {truncateAddress(addresses.stellarForge)} <ExternalIcon />
          </a>
          <CopyButton value={addresses.stellarForge} label="Copy address" />
        </p>
      ) : null}
    </div>
  )
}

function ForgeCard({
  item,
  price,
  trophies,
  trophiesLoading,
  owned,
  onOpenInventory,
}: {
  item: StoreItem
  price: bigint
  trophies: bigint | undefined
  trophiesLoading: boolean
  owned: bigint | undefined
  onOpenInventory: () => void
}) {
  const [qty, setQty] = useState(1)
  const [forgedHash, setForgedHash] = useState<Hash>()
  const cost = price * BigInt(qty)

  return (
    <article className="card flex min-w-0 flex-col overflow-hidden p-4 sm:p-5">
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-5">
        <div className="relative">
          <img
            src={itemArt(item.id)}
            alt={item.name}
            width={512}
            height={512}
            loading="lazy"
            className="aspect-square w-full rounded-2xl border border-border shadow-[0_18px_40px_-24px_rgb(16_185_129/0.6)]"
          />
          {owned && owned > 0n ? (
            <span className="absolute right-2 top-2 rounded-full border border-accent-2/40 bg-bg/85 px-2 py-0.5 font-mono text-xs text-accent-2 backdrop-blur">
              ×{owned.toString()}
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="eyebrow truncate">
            #{item.id.toString()} · {item.kind}
          </p>
          <h3 className="mt-1.5 text-lg font-semibold leading-tight sm:text-xl">{item.name}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.effect}</p>
          <p className="mt-3 flex items-baseline gap-1.5">
            {price > 0n ? (
              <>
                <span className="font-mono text-xl font-semibold tabular-nums text-text">{price.toString()}</span>
                <span className="text-sm text-muted">{price === 1n ? 'trophy' : 'trophies'} each</span>
              </>
            ) : (
              <span className="chip h-7 text-xs text-muted">Not redeemable right now</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-auto space-y-4 pt-5">
        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
          <QuantityStepper value={qty} onChange={setQty} itemName={item.name} />
          <div className="min-w-0 text-right">
            <p className="eyebrow">Costs</p>
            <p className="truncate font-mono text-lg font-semibold tabular-nums text-accent-2">
              {cost.toString()} <span className="text-sm font-normal text-muted">{cost === 1n ? 'trophy' : 'trophies'}</span>
            </p>
          </div>
        </div>
        {forgedHash ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-accent/[0.08] px-3 py-2 text-sm" aria-live="polite">
            <span className="inline-flex items-center gap-1 text-accent-2">
              <CheckIcon size={15} /> Redeemed
            </span>
            <a className="link inline-flex items-center gap-1" href={explorerTxUrl(forgedHash)} target="_blank" rel="noreferrer">
              tx <ExternalIcon />
            </a>
            <button type="button" className="link ml-auto inline-flex items-center gap-1 font-medium" onClick={onOpenInventory}>
              Inventory <ArrowIcon size={14} />
            </button>
          </p>
        ) : null}
        <ForgeAction
          item={item}
          qty={qty}
          cost={cost}
          trophies={trophies}
          trophiesLoading={trophiesLoading}
          onForged={setForgedHash}
        />
      </div>
    </article>
  )
}

/** Wallet gate + the single redeem transaction for one item. */
function ForgeAction({
  item,
  qty,
  cost,
  trophies,
  trophiesLoading,
  onForged,
}: {
  item: StoreItem
  qty: number
  cost: bigint
  trophies: bigint | undefined
  trophiesLoading: boolean
  onForged: (hash: Hash) => void
}) {
  const { isConnected, chainId } = useConnection()
  const switchChain = useSwitchChain()
  const label = `Redeem ${qty} × ${item.name}`

  if (!FORGE_DEPLOYED) {
    return (
      <button type="button" className="btn btn-ghost w-full" disabled>
        The Forge is not deployed yet
      </button>
    )
  }
  if (!isConnected) return <ConnectButton className="w-full" />
  if (chainId !== CHAIN_ID) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          className="btn btn-ghost w-full"
          disabled={switchChain.isPending}
          onClick={() => switchChain.mutate({ chainId: CHAIN_ID })}
        >
          {switchChain.isPending ? <Spinner /> : null}
          Switch to Sepolia
        </button>
        {switchChain.error ? <p className="text-sm text-danger">{describeError(switchChain.error)}</p> : null}
      </div>
    )
  }
  if (trophiesLoading || trophies === undefined) return <span className="skeleton block h-11 w-full" />

  const short = cost > trophies ? cost - trophies : 0n
  return (
    <div className="space-y-2.5">
      {short > 0n ? (
        <p className="text-sm leading-relaxed text-warning">
          You need {short.toString()} more {short === 1n ? 'trophy' : 'trophies'}.{' '}
          <a className="link font-medium" href={ARENA_URL}>
            Win runs in the Arena or Arcade
          </a>{' '}
          to earn them.
        </p>
      ) : null}
      <TxButton
        request={{ address: addresses.stellarForge, abi: stellarForgeAbi, functionName: 'redeem', args: [item.id, BigInt(qty)] }}
        errorMessages={FORGE_ERRORS}
        onConfirmed={onForged}
        disabled={short > 0n || cost === 0n}
        className="w-full"
      >
        {label}
      </TxButton>
    </div>
  )
}
