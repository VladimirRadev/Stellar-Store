import { useState } from 'react'
import type { Hash } from 'viem'
import { useConnection, useSwitchChain } from 'wagmi'
import { iVladTokenAbi, stellarStoreAbi } from '../abi'
import { CHAIN_ID, addresses } from '../config/addresses'
import { describeError } from '../shell/errors'
import { explorerTxUrl, formatToken } from '../shell/format'
import { ArrowIcon, CheckIcon, ExternalIcon, Spinner } from '../shell/icons'
import { getSite } from '../shell/sites'
import { TxButton } from '../shell/TxButton'
import { ConnectButton } from '../shell/WalletButton'
import { ARENA_URL, DEPLOYED, STORE_ERRORS, itemArt } from './catalog'
import type { StoreData, StoreItem, UserData } from './useStoreData'

const MAX_QTY = 20

const FAUCET_URL = getSite('faucet').url

export function ShopTab({ data, onOpenInventory }: { data: StoreData; onOpenInventory: () => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold sm:text-3xl">Pick your gear</h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
            Choose a quantity, approve the VLAD total, then buy. Items land in your wallet as{' '}
            <span className="whitespace-nowrap">ERC-1155</span> tokens.
          </p>
        </div>
        <a className="link inline-flex items-center gap-1.5 text-sm font-medium" href={ARENA_URL}>
          Use it in the Arena <ArrowIcon size={15} />
        </a>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {data.items.map((item, i) => (
          <ItemCard
            key={item.id.toString()}
            item={item}
            owned={data.user.counts?.[i]}
            priceLoading={data.itemsLoading}
            user={data.user}
            onOpenInventory={onOpenInventory}
          />
        ))}
      </div>
    </div>
  )
}

function ItemCard({
  item,
  owned,
  priceLoading,
  user,
  onOpenInventory,
}: {
  item: StoreItem
  owned: bigint | undefined
  priceLoading: boolean
  user: UserData
  onOpenInventory: () => void
}) {
  const [qty, setQty] = useState(1)
  const [boughtHash, setBoughtHash] = useState<Hash>()
  const total = item.price * BigInt(qty)

  return (
    <article className="card flex min-w-0 flex-col overflow-hidden p-4 sm:p-5">
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-5 lg:grid-cols-1">
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
          <div className="mt-3 flex items-baseline gap-1.5">
            {priceLoading ? (
              <span className="skeleton h-6 w-20" />
            ) : item.buyable ? (
              <>
                <span className="font-mono text-xl font-semibold tabular-nums text-text">{formatToken(item.price)}</span>
                <span className="text-sm text-muted">VLAD each</span>
              </>
            ) : (
              <span className="chip h-7 border-lime/30 text-xs text-lime">Arena reward only</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-5">
        {item.buyable ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
              <QuantityStepper value={qty} onChange={setQty} itemName={item.name} />
              <div className="min-w-0 text-right">
                <p className="eyebrow">Total</p>
                <p className="truncate font-mono text-lg font-semibold tabular-nums text-accent-2">
                  {formatToken(total)} <span className="text-sm font-normal text-muted">VLAD</span>
                </p>
              </div>
            </div>
            {boughtHash ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-accent/[0.08] px-3 py-2 text-sm" aria-live="polite">
                <span className="inline-flex items-center gap-1 text-accent-2">
                  <CheckIcon size={15} /> Purchase confirmed
                </span>
                <a className="link inline-flex items-center gap-1" href={explorerTxUrl(boughtHash)} target="_blank" rel="noreferrer">
                  tx <ExternalIcon />
                </a>
                <button type="button" className="link ml-auto inline-flex items-center gap-1 font-medium" onClick={onOpenInventory}>
                  Inventory <ArrowIcon size={14} />
                </button>
              </p>
            ) : null}
            <BuyAction item={item} qty={qty} total={total} user={user} onBought={setBoughtHash} />
          </div>
        ) : (
          <div className="space-y-3 border-t border-border/70 pt-4">
            <p className="text-sm leading-relaxed text-muted">
              Minted by the Arena contract (it holds <span className="font-mono text-text/80">GAME_ROLE</span>) each
              time you win a run.
            </p>
            <a className="btn btn-ghost w-full" href={ARENA_URL}>
              Win one in the Arena <ArrowIcon size={15} />
            </a>
          </div>
        )}
      </div>
    </article>
  )
}

function QuantityStepper({ value, onChange, itemName }: { value: number; onChange: (n: number) => void; itemName: string }) {
  const btn =
    'grid size-10 place-items-center text-lg text-muted transition hover:text-text disabled:cursor-not-allowed disabled:opacity-35'
  return (
    <div className="inline-flex shrink-0 items-center rounded-xl border border-border bg-surface/70" role="group" aria-label={`${itemName} quantity`}>
      <button type="button" className={btn} aria-label="Decrease quantity" disabled={value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output className="w-8 text-center font-mono text-base font-semibold tabular-nums" aria-live="polite">
        {value}
      </output>
      <button type="button" className={btn} aria-label="Increase quantity" disabled={value >= MAX_QTY} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}

/** Wallet gate + approve-then-buy flow for one item. */
function BuyAction({
  item,
  qty,
  total,
  user,
  onBought,
}: {
  item: StoreItem
  qty: number
  total: bigint
  user: UserData
  onBought: (hash: Hash) => void
}) {
  const { isConnected, chainId } = useConnection()
  const switchChain = useSwitchChain()

  if (!DEPLOYED) {
    return (
      <button type="button" className="btn btn-ghost w-full" disabled>
        Opens after deployment
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
  if (user.loading || user.vladBalance === undefined || user.allowance === undefined) {
    return <span className="skeleton block h-11 w-full" />
  }
  if (user.vladBalance < total) {
    return (
      <div className="space-y-2.5">
        <p className="text-sm text-warning">
          You have {formatToken(user.vladBalance)} VLAD; this costs {formatToken(total)} VLAD.
        </p>
        <a className="btn btn-ghost w-full" href={FAUCET_URL}>
          Get VLAD at the Faucet <ArrowIcon size={15} />
        </a>
      </div>
    )
  }

  const approved = user.allowance >= total
  return (
    <div className="space-y-3">
      <StepTrack approved={approved} />
      {approved ? (
        <TxButton
          key="buy"
          request={{ address: addresses.store, abi: stellarStoreAbi, functionName: 'buy', args: [item.id, BigInt(qty)] }}
          errorMessages={STORE_ERRORS}
          onConfirmed={onBought}
          className="w-full"
        >
          Buy {qty} × {item.name}
        </TxButton>
      ) : (
        <TxButton
          key="approve"
          request={{ address: addresses.vladToken, abi: iVladTokenAbi, functionName: 'approve', args: [addresses.store, total] }}
          errorMessages={STORE_ERRORS}
          className="w-full"
        >
          Approve {formatToken(total)} VLAD
        </TxButton>
      )}
    </div>
  )
}

function StepTrack({ approved }: { approved: boolean }) {
  const dot = 'grid size-5 place-items-center rounded-full text-[0.65rem] font-semibold'
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Purchase steps">
      <li className={`inline-flex items-center gap-1.5 ${approved ? 'text-accent-2' : 'text-text'}`}>
        <span className={`${dot} ${approved ? 'bg-accent/20' : 'bg-accent text-bg'}`}>
          {approved ? <CheckIcon size={12} /> : '1'}
        </span>
        Approve VLAD
      </li>
      <li aria-hidden className="h-px flex-1 bg-border" />
      <li className={`inline-flex items-center gap-1.5 ${approved ? 'text-text' : 'text-muted'}`}>
        <span className={`${dot} ${approved ? 'bg-accent text-bg' : 'border border-border'}`}>2</span>
        Buy
      </li>
    </ol>
  )
}
