import { useState, type ReactNode } from 'react'
import type { Address } from 'viem'
import { useConnection } from 'wagmi'
import { explorerAddressUrl, formatToken, truncateAddress } from '../shell/format'
import { ArrowIcon, ExternalIcon, StarGlyph } from '../shell/icons'
import { currentSite, getSite } from '../shell/sites'
import { StatTile } from '../shell/StatTile'
import { Tabs } from '../shell/Tabs'
import { DEPLOYED, itemArt, metadataUrl } from './catalog'
import { InventoryTab } from './InventoryTab'
import { ShopTab } from './ShopTab'
import { useStoreData } from './useStoreData'

type TabKey = 'shop' | 'inventory'

const ARENA_URL = getSite('arena').url

/** Stellar Store: buy ERC-1155 Arena items with VLAD (Shop) and see what you own (Inventory). */
export function StoreApp() {
  const data = useStoreData()
  const { isConnected } = useConnection()
  const [tab, setTab] = useState<TabKey>(() => (window.location.hash === '#inventory' ? 'inventory' : 'shop'))

  const openTab = (key: TabKey, scroll = false) => {
    setTab(key)
    const { pathname, search } = window.location
    window.history.replaceState(null, '', key === 'inventory' ? `${pathname}${search}#inventory` : `${pathname}${search}`)
    if (scroll) document.getElementById('store')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const counts = data.user.counts
  const owned = counts?.reduce((sum, n) => sum + n, 0n)
  const [sword, shield] = data.items

  return (
    <div className="space-y-12 sm:space-y-16">
      {!DEPLOYED ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm text-warning">
          Contracts are not deployed yet. The addresses in <code className="font-mono">config/addresses.ts</code> are
          placeholders, so on-chain reads are switched off and the prices shown are the launch prices.
        </div>
      ) : null}

      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0 pt-2">
          <p className="eyebrow inline-flex items-center gap-2">
            <StarGlyph size={12} /> Stellar suite · item store
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            Guardian{' '}
            <span className="bg-gradient-to-r from-lime via-accent-2 to-accent bg-clip-text text-transparent">armory</span>
          </h1>
          <p className="mt-3 font-display text-lg text-text/90 sm:text-xl">ERC-1155 game items for the Arena, paid in $VLAD</p>
          <p className="mt-5 max-w-xl text-[0.95rem] leading-relaxed text-muted">
            Gear up before a run. The Guardian Sword adds +10 to your attack roll, the Guardian Shield gives back half
            of your stake if you lose, and every won run earns you an Arena Trophy.
          </p>
          <TreasuryNote treasury={data.treasury} />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn btn-primary" onClick={() => openTab('shop', true)}>
              Browse the shop
            </button>
            <a className="btn btn-ghost" href={ARENA_URL}>
              Use it in the Arena <ArrowIcon size={15} />
            </a>
          </div>
        </div>
        <HeroArt />
      </section>

      <section aria-label="Store statistics" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Arena prize pool"
          value={formatToken(data.prizePool)}
          unit="VLAD"
          loading={data.prizePoolLoading}
          hint="treasury balance"
          highlight
        />
        <StatTile
          label="Your VLAD"
          value={isConnected ? formatToken(data.user.vladBalance) : '—'}
          unit={isConnected ? 'VLAD' : undefined}
          loading={data.user.loading}
          hint={isConnected ? 'connected wallet' : 'connect a wallet'}
        />
        <StatTile
          label="Your items"
          value={owned !== undefined ? owned.toString() : '—'}
          loading={data.user.loading}
          hint="sword · shield · trophy"
        />
        <StatTile
          label="Prices"
          value={`${formatToken(sword?.price)} / ${formatToken(shield?.price)}`}
          unit="VLAD"
          loading={data.itemsLoading}
          hint="sword / shield"
        />
      </section>

      <section id="store" aria-label="Store" className="scroll-mt-32">
        <Tabs
          tabs={[
            { key: 'shop', label: 'Shop' },
            { key: 'inventory', label: owned && owned > 0n ? `Inventory · ${owned}` : 'Inventory' },
          ]}
          value={tab}
          onChange={(key) => openTab(key)}
          label="Store sections"
        />
        <div className="mt-6" role="tabpanel">
          {tab === 'shop' ? (
            <ShopTab data={data} onOpenInventory={() => openTab('inventory', true)} />
          ) : (
            <InventoryTab data={data} onOpenShop={() => openTab('shop', true)} />
          )}
        </div>
      </section>

      <HowItWorks />
    </div>
  )
}

function TreasuryNote({ treasury }: { treasury: Address | undefined }) {
  return (
    <div className="mt-6 flex min-w-0 max-w-xl items-start gap-3 rounded-2xl border border-accent/25 bg-accent/[0.06] p-3.5 pr-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent/15">
        <StarGlyph size={15} />
      </span>
      <p className="min-w-0 text-sm leading-relaxed text-text/90">
        Every purchase funds the Arena prize pool: 100% of the VLAD you pay goes to the treasury{' '}
        {treasury ? (
          <a
            className="link inline-flex items-center gap-1 font-mono"
            href={explorerAddressUrl(treasury)}
            target="_blank"
            rel="noreferrer"
            title={treasury}
          >
            {truncateAddress(treasury)} <ExternalIcon />
          </a>
        ) : (
          <span className="font-mono text-muted">{DEPLOYED ? '…' : '(not deployed yet)'}</span>
        )}
        .
      </p>
    </div>
  )
}

function HeroArt() {
  const img = 'absolute aspect-square rounded-3xl border border-border shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)]'
  return (
    <div aria-hidden className="relative mx-auto h-52 w-full max-w-md sm:h-72 lg:h-96 lg:max-w-lg">
      <div className="absolute inset-0 m-auto size-56 rounded-full bg-accent/25 blur-3xl sm:size-72" />
      <img src={itemArt(2n)} alt="" width={512} height={512} className={`${img} left-[2%] top-[16%] w-[40%] -rotate-12`} />
      <img src={itemArt(3n)} alt="" width={512} height={512} className={`${img} right-[2%] top-[16%] w-[40%] rotate-12`} />
      <img
        src={itemArt(1n)}
        alt=""
        width={512}
        height={512}
        className={`${img} left-1/2 top-0 z-10 w-[46%] -translate-x-1/2 shadow-[0_30px_70px_-24px_rgb(16_185_129/0.55)]`}
      />
    </div>
  )
}

const HOW_IT_WORKS: { title: string; body: ReactNode }[] = [
  {
    title: 'One ERC-1155 contract',
    body: (
      <>
        Sword, Shield and Trophy are token ids <span className="font-mono text-text/90">1</span>,{' '}
        <span className="font-mono text-text/90">2</span> and <span className="font-mono text-text/90">3</span> of a
        single ERC-1155 contract. Your wallet holds a balance for each id.
      </>
    ),
  },
  {
    title: 'Paid in VLAD',
    body: (
      <>
        <span className="font-mono text-text/90">buy(id, amount)</span> moves price × amount VLAD from your wallet to the
        treasury with <span className="font-mono text-text/90">transferFrom</span>, so you approve the store first. The
        store never holds VLAD.
      </>
    ),
  },
  {
    title: 'Arena-only burn and mint',
    body: (
      <>
        Only the Stellar Arena holds <span className="font-mono text-text/90">GAME_ROLE</span>: it calls{' '}
        <span className="font-mono text-text/90">consume</span> to burn an item you use in a run and{' '}
        <span className="font-mono text-text/90">award</span> to mint a Trophy when you win. Nobody else can.
      </>
    ),
  },
  {
    title: 'Metadata on GitHub Pages',
    body: (
      <>
        <span className="font-mono text-text/90">uri(id)</span> returns{' '}
        <a className="link font-mono" href={metadataUrl(1n)} target="_blank" rel="noreferrer">
          metadata/1.json
        </a>
        , an OpenSea-style JSON with the item art, served from this site.
      </>
    ),
  },
]

function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className="card overflow-hidden p-5 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-accent/15 blur-3xl" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Under the hood</p>
          <h2 id="how-it-works" className="mt-2 text-2xl font-semibold sm:text-3xl">
            How it works
          </h2>
        </div>
        <a className="link inline-flex items-center gap-1.5 text-sm" href={currentSite.repo} target="_blank" rel="noreferrer">
          Contract source <ExternalIcon />
        </a>
      </div>
      <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {HOW_IT_WORKS.map((step, i) => (
          <li key={step.title} className="min-w-0">
            <span className="font-mono text-xs text-accent-2">0{i + 1}</span>
            <p className="mt-2 font-display font-semibold">{step.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
