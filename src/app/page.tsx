'use client'

import { useState } from 'react'
import DashboardTab from '@/components/coach/DashboardTab'
import LiveTab from '@/components/coach/LiveTab'
import TeamTab from '@/components/coach/TeamTab'
import LeagueTab from '@/components/coach/LeagueTab'
import PlayersTab from '@/components/coach/PlayersTab'
import AssistantTab from '@/components/coach/AssistantTab'
import { House, MessageSquare, Radio, Search, Shirt, Trophy } from 'lucide-react'

const TABS = [
  { key: 'accueil', label: 'Accueil', icon: House },
  { key: 'equipe', label: 'Mon équipe', icon: Shirt },
  { key: 'ligue', label: 'Ligue', icon: Trophy },
  { key: 'marche', label: 'Marché', icon: Search },
  { key: 'live', label: 'Live', icon: Radio },
  { key: 'assistant', label: 'Assistant', icon: MessageSquare },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function Home() {
  const [tab, setTab] = useState<TabKey>('accueil')

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-black leading-tight sm:text-lg">
              Fantasy Coach <span className="font-bold text-red-600">· Le fond de la classe</span>
            </h1>
            <p className="text-[11px] text-slate-500">Sofascore Fantasy Premier League 2026/27 · Vital_GDB</p>
          </div>
        </div>
        {/* Nav onglets */}
        <nav className="mx-auto max-w-5xl overflow-x-auto px-2 pb-1.5" aria-label="Navigation principale">
          <div className="flex gap-1">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  aria-current={tab === t.key ? 'page' : undefined}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                    tab === t.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </nav>
      </header>

      {/* Contenu */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 pb-16">
        {tab === 'accueil' && <DashboardTab onGoTeam={() => setTab('equipe')} />}
        {tab === 'equipe' && <TeamTab />}
        {tab === 'ligue' && <LeagueTab />}
        {tab === 'marche' && <PlayersTab />}
        {tab === 'live' && <LiveTab />}
        {tab === 'assistant' && <AssistantTab />}
      </main>
    </div>
  )
}
