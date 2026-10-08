import { formatToken } from '../shell/format'
import { ArrowIcon } from '../shell/icons'
import { NetworkGate } from '../shell/NetworkGate'
import { getSite } from '../shell/sites'
import { StatTile } from '../shell/StatTile'
import { DEPLOYED, itemArt } from './catalog'
import type { StoreData } from './useStoreData'

const ARENA_URL = getSite('arena').url

export function InventoryTab({ data, onOpenShop }: { data: StoreData; onOpenShop: () => void }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold sm:text-3xl">Your items</h2>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
        Your ERC-1155 balances for item ids 1–3, read in one <code className="font-mono text-text/80">balanceOfBatch</code>{' '}
        call.
      </p>
      <div className="mt-6">
        <NetworkGate connectMessage="Connect MetaMask to see the items in your wallet.">
          <InventoryPanel data={data} onOpenShop={onOpenShop} />
        </NetworkGate>
      </div>
    </div>
  )
}

function InventoryPanel({ data, onOpenShop }: { data: StoreData; onOpenShop: () => void }) {
  const { counts, loading } = data.user

  if (!DEPLOYED) {
    return (
      <EmptyBox
        title="Inventory opens after deployment"
        text="The store contract is not deployed yet, so there are no balances to read."
        onOpenShop={onOpenShop}
      />
    )
  }
  if (loading || !counts) {
    return (
      <div className="grid gap-3 lg:grid-cols-3" aria-busy>
        {data.items.map((item) => (
          <span key={item.id.toString()} className="skeleton block h-24 w-full rounded-[1.25rem]" />
        ))}
      </div>
    )
  }

  const totalItems = counts.reduce((sum, n) => sum + n, 0n)
  if (totalItems === 0n) {
    return (
      <EmptyBox
        title="Your inventory is empty"
        text="Buy a Guardian Sword or Shield in the shop, or win a run in the Arena to earn a Trophy."
        onOpenShop={onOpenShop}
      />
    )
  }

  const value = data.items.reduce((sum, item, i) => sum + item.price * (counts[i] ?? 0n), 0n)
  const trophies = counts[2] ?? 0n

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatTile label="Items owned" value={totalItems.toString()} hint="across all item ids" highlight />
        <StatTile label="Value at store prices" value={formatToken(value)} unit="VLAD" hint="trophies are priceless" />
        <div className="col-span-2 lg:col-span-1">
          <StatTile label="Arena trophies" value={trophies.toString()} hint="one per won run" />
        </div>
      </div>

      <ul className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        {data.items.map((item, i) => {
          const count = counts[i] ?? 0n
          return (
            <li
              key={item.id.toString()}
              className={`card flex min-w-0 items-center gap-4 p-3.5 sm:p-4 ${count === 0n ? 'opacity-55' : ''}`}
            >
              <img
                src={itemArt(item.id)}
                alt=""
                width={512}
                height={512}
                loading="lazy"
                className="size-16 shrink-0 rounded-xl border border-border sm:size-20"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-semibold">{item.name}</p>
                <p className="truncate text-xs text-muted">
                  {item.buyable && count > 0n
                    ? `${formatToken(item.price * count)} VLAD at current price`
                    : item.buyable
                      ? `${formatToken(item.price)} VLAD each in the shop`
                      : 'Awarded for Arena wins'}
                </p>
              </div>
              <span className={`shrink-0 font-mono text-2xl font-semibold tabular-nums ${count > 0n ? 'text-accent-2' : 'text-muted'}`}>
                ×{count.toString()}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="card flex flex-col items-start gap-4 overflow-hidden p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 -top-16 size-48 rounded-full bg-lime/10 blur-3xl"
        />
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">Ready for a run?</p>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            Bring your items into the Arena: the Sword adds +10 to your attack roll, the Shield gives back 50% of your
            stake if you lose.
          </p>
        </div>
        <a className="btn btn-primary w-full shrink-0 sm:w-auto" href={ARENA_URL}>
          Play now <ArrowIcon size={16} />
        </a>
      </div>
    </div>
  )
}

function EmptyBox({ title, text, onOpenShop }: { title: string; text: string; onOpenShop: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/40 px-5 py-8 text-center sm:py-10">
      <div className="flex justify-center -space-x-4" aria-hidden>
        {[1n, 2n, 3n].map((id, i) => (
          <img
            key={id.toString()}
            src={itemArt(id)}
            alt=""
            width={512}
            height={512}
            className={`size-16 rounded-xl border border-border opacity-50 grayscale-[0.4] sm:size-20 ${
              i === 0 ? '-rotate-6' : i === 2 ? 'rotate-6' : 'relative z-10 -translate-y-1'
            }`}
          />
        ))}
      </div>
      <p className="mt-5 font-display text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">{text}</p>
      <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" className="btn btn-primary" onClick={onOpenShop}>
          Browse the shop
        </button>
        <a className="btn btn-ghost" href={ARENA_URL}>
          Play in the Arena <ArrowIcon size={15} />
        </a>
      </div>
    </div>
  )
}
