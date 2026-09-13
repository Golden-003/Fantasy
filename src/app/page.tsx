'use client'

import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import type { OverviewPayload, LeagueData, PlayerRow, TeamFixtureRow } from '@/lib/coach/types'
import { TeamTab } from '@/components/coach/TeamTab'
import { PlayersTab } from '@/components/coach/PlayersTab'
import { TransfersTab } from '@/components/coach/TransfersTab'
import { FixturesTab } from '@/components/coach/FixturesTab'
import { AlertsTab } from '@/components/coach/AlertsTab'
import { LeagueTab } from '@/components/coach/LeagueTab'
import { AssistantTab } from '@/components/coach/AssistantTab'
import { PlayerDialog } from '@/components/coach/PlayerDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface FixturePayload { teams: TeamFixtureRow[]; nextGw: number }

export default function Home() {
  const [overview, setOverview] = useState<OverviewPayload | null>(null)
  const [players, setPlayers] = useState<PlayerRow[] | null>(null)
  const [fixtures, setFixtures] = useState<FixturePayload | null>(null)
  const [league, setLeague] = useState<LeagueData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PlayerRow | null>(null)
  const [tab, setTab] = useState('team')

  const load = useCallback(async () => {
    try {
      const [ov, pl, fx, lg] = await Promise.all([
        fetch('/api/coach/overview').then((r) => r.json()),
        fetch('/api/coach/players').then((r) => r.json()),
        fetch('/api/coach/fixtures').then((r) => r.json()),
        fetch('/api/coach/league').then((r) => r.json()),
      ])
      if (ov.error || pl.error || fx.error || lg.error) throw new Error('data')
      setOverview(ov)
      setPlayers(pl.players)
      setFixtures(fx)
      setLeague(lg)
      setError(null)
    } catch {
      setError('Impossible de charger les données du coach. Réessaie.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onSelect = useCallback((id?: string) => {
    if (!id || !players) return
    const p = players.find((x) => x.id === id)
    if (p) setSelected(p)
  }, [players])

  const nextGw = overview?.nextGw ?? fixtures?.nextGw ?? 9
  const alertCounts = overview
    ? {
        danger: overview.alerts.filter((a) => a.severity === 'danger').length,
        warning: overview.alerts.filter((a) => a.severity === 'warning').length,
      }
    : null

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0f1f18_0%,#020617_55%)] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-lg shadow-lg shadow-emerald-600/30">⚽</span>
            <div>
              <h1 className="text-base font-extrabold leading-tight tracking-tight">Fantasy Coach <span className="text-emerald-400">Premier League</span></h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">{overview?.seasonLabel ?? '…'} • Ligue privée à 5</p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {overview && (
              <>
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Journée {nextGw}</Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-300">💰 {overview.me.bank.toFixed(1).replace('.', ',')}M</Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-300">🔄 {overview.me.transfersLeft} transfert{overview.me.transfersLeft > 1 ? 's' : ''}</Badge>
                <Badge variant="outline" className={cn('border-slate-700', overview.me.rank <= 2 ? 'text-amber-300' : 'text-slate-300')}>🏆 {overview.me.rank}<sup>e</sup>/5</Badge>
                {alertCounts && alertCounts.danger > 0 && (
                  <Badge className="border-red-500/50 bg-red-500/15 text-red-300">🚨 {alertCounts.danger + alertCounts.warning}</Badge>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 pb-16">
        {error && (
          <div className="mx-auto mt-16 max-w-md rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={load} className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-200 hover:bg-red-500/30">Réessayer</button>
          </div>
        )}
        {!error && (!overview || !players || !fixtures || !league) && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl bg-slate-900" />)}</div>
            <Skeleton className="h-72 rounded-xl bg-slate-900" />
          </div>
        )}
        {!error && overview && players && fixtures && league && (
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
              {[
                { v: 'team', l: '🧍 Mon équipe' },
                { v: 'players', l: '📊 Joueurs' },
                { v: 'transfers', l: '🔁 Transferts' },
                { v: 'calendar', l: '📅 Calendrier' },
                { v: 'alerts', l: '🚨 Alertes' },
                { v: 'league', l: '⚔️ War Room' },
                { v: 'assistant', l: '🤖 Assistant' },
              ].map((t) => (
                <TabsTrigger key={t.v} value={t.v} className="rounded-lg px-3 py-1.5 text-xs font-medium data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:text-sm">
                  {t.l}
                  {t.v === 'alerts' && alertCounts && (alertCounts.danger > 0 || alertCounts.warning > 0) && (
                    <span className="ml-1 rounded-full bg-red-500/80 px-1.5 text-[9px] font-bold text-white">{alertCounts.danger + alertCounts.warning}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="team"><TeamTab data={overview} onSelect={onSelect} /></TabsContent>
            <TabsContent value="players"><PlayersTab players={players} onSelect={onSelect} /></TabsContent>
            <TabsContent value="transfers"><TransfersTab data={overview} onSelect={onSelect} /></TabsContent>
            <TabsContent value="calendar"><FixturesTab teams={fixtures.teams} /></TabsContent>
            <TabsContent value="alerts"><AlertsTab alerts={overview.alerts} onSelect={onSelect} /></TabsContent>
            <TabsContent value="league"><LeagueTab league={league} onSelect={onSelect} /></TabsContent>
            <TabsContent value="assistant"><AssistantTab nextGw={nextGw} /></TabsContent>
          </Tabs>
        )}
      </main>

      <footer className="border-t border-slate-800/70 py-4">
        <div className="mx-auto max-w-7xl px-4 text-center text-[11px] text-slate-600">
          Fantasy Coach • Copilote personnel d&apos;aide à la décision • Données de démonstration (couche Data Provider interchangeable)
        </div>
      </footer>

      <PlayerDialog player={selected} open={!!selected} onClose={() => setSelected(null)} nextGw={nextGw} />
    </div>
  )
}
