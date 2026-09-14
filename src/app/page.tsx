'use client'

import { useState } from 'react'
import DashboardTab from '@/components/coach/DashboardTab'
import LiveTab from '@/components/coach/LiveTab'
import TeamTab from '@/components/coach/TeamTab'
import LeagueTab from '@/components/coach/LeagueTab'
import PlayersTab from '@/components/coach/PlayersTab'
import FixturesTab from '@/components/coach/FixturesTab'
import AssistantTab from '@/components/coach/AssistantTab'
import DataTab from '@/components/coach/DataTab'
import { BadgeCheck } from 'lucide-react'

const TABS = [
  { key: 'accueil', label: 'Accueil' },
  { key: 'live', label: 'Live' },
  { key: 'equipe', label: 'Mon Équipe' },
  { key: 'ligue', label: 'Ligue' },
  { key: 'marche', label: 'Marché' },
  { key: 'calendrier', label: 'Calendrier' },
  { key: 'assistant', label: 'Assistant' },
  { key: 'donnees', label: 'Données' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function Home() {
  const [tab, setTab] = useState<TabKey>('accueil')

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-black leading-tight sm:text-lg">
              Fantasy Coach <span className="text-violet-400">· Le fond de la classe</span>
            </h1>
            <p className="text-[11px] text-zinc-500">Sofascore Fantasy Premier League 2026/27 · Vital_GDB</p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 sm:inline-flex">
            <BadgeCheck className="h-3.5 w-3.5" /> DONNÉES 100% RÉELLES
          </span>
        </div>
        {/* Nav onglets */}
        <nav className="mx-auto max-w-5xl overflow-x-auto px-2 pb-1.5" aria-label="Navigation principale">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? 'page' : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  tab === t.key ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Contenu */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 pb-16">
        {tab === 'accueil' && <DashboardTab onGoAssistant={() => setTab('assistant')} />}
        {tab === 'live' && <LiveTab />}
        {tab === 'equipe' && <TeamTab />}
        {tab === 'ligue' && <LeagueTab />}
        {tab === 'marche' && <PlayersTab />}
        {tab === 'calendrier' && <FixturesTab />}
        {tab === 'assistant' && <AssistantTab />}
        {tab === 'donnees' && <DataTab />}
      </main>

      {/* Footer sticky naturellement */}
      <footer className="mt-auto border-t border-border bg-background">
        <div className="mx-auto max-w-5xl px-4 py-3 text-center text-[11px] text-zinc-500">
          Sources réelles : captures Sofascore de Vital_GDB (13 sept 2026) · articles officiels Sofascore (Picks R4 du 11 sept, règles 2026/27 du 28 août) · zéro donnée inventée
        </div>
      </footer>
    </div>
  )
}
