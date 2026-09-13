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
import { SetupDialog } from '@/components/coach/SetupDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface FixturePayload { teams: TeamFixtureRow[]; nextGw: number }

const NEED_SETUP = 'NEED_SETUP'

export default function Home() {
  const [phase, setPhase] = useState<'loading' | 'setup' | 'ready'>('loading')
  const [overview, setOverview] = useState<OverviewPayload | null>(null)
  const [players, setPlayers] = useState<PlayerRow[] | null>(null)
  const [fixtures, setFixtures] = useState<FixturePayload | null>(null)
  const [league, setLeague] = useState<LeagueData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PlayerRow | null>(null)
  const [tab, setTab] = useState('team')
  const [setupOpen, setSetupOpen] = useState(false)
  const [syncTime, setSyncTime] = useState<string | null>(null)

  // Données publiques réelles : base joueurs + calendrier (fonctionnent sans connexion)
  const loadPublic = useCallback(async () => {
    try {
      const [pl, fx] = await Promise.all([
        fetch('/api/coach/players').then((r) => r.json()),
        fetch('/api/coach/fixtures').then((r) => r.json()),
      ])
      if (pl.players) setPlayers(pl.players)
      if (fx.teams) setFixtures(fx)
    } catch { /* silencieux : réessayable via Réglages */ }
  }, [])

  // Données privées réelles : mon équipe + ma ligue (nécessitent Team ID / League ID)
  const loadPrivate = useCallback(async () => {
    try {
      const [ov, lg] = await Promise.all([
        fetch('/api/coach/overview').then((r) => r.json()),
        fetch('/api/coach/league').then((r) => r.json()),
      ])
      if (ov.error === NEED_SETUP || lg.error === NEED_SETUP) {
        setPhase('setup')
        setSetupOpen(true)
        return
      }
      if (ov.error || lg.error) throw new Error('data')
      setOverview(ov)
      setLeague(lg)
      setSyncTime(ov.syncedAt ? new Date(ov.syncedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null)
      setPhase('ready')
      setError(null)
      setTab((t) => (t === 'team' || t === 'players' || t === 'calendar' ? t : 'team'))
    } catch {
      setError('Impossible de charger les données réelles. Vérifie ta connexion ou tes IDs dans ⚙️ Réglages.')
      setPhase('setup')
    }
  }, [])

  useEffect(() => {
    loadPublic()
    fetch('/api/settings').then((r) => r.json()).then((s) => {
      if (s.configured) loadPrivate()
      else {
        setPhase('setup')
        setSetupOpen(true)
      }
    }).catch(() => setPhase('setup'))
  }, [loadPublic, loadPrivate])

  const refreshAll = useCallback(() => {
    setOverview(null); setLeague(null)
    loadPublic()
    loadPrivate()
  }, [loadPublic, loadPrivate])

  const onSelect = useCallback((id?: string) => {
    if (!id || !players) return
    const p = players.find((x) => x.id === id)
    if (p) setSelected(p)
  }, [players])

  const nextGw = overview?.nextGw ?? fixtures?.nextGw ?? 5
  const alertCounts = overview
    ? {
        danger: overview.alerts.filter((a) => a.severity === 'danger').length,
        warning: overview.alerts.filter((a) => a.severity === 'warning').length,
      }
    : null
  const configured = phase === 'ready' && !!overview

  const tabs = [
    { v: 'team', l: '🧍 Mon équipe', needsConfig: true },
    { v: 'players', l: '📊 Joueurs', needsConfig: false },
    { v: 'transfers', l: '🔁 Transferts', needsConfig: true },
    { v: 'calendar', l: '📅 Calendrier', needsConfig: false },
    { v: 'alerts', l: '🚨 Alertes', needsConfig: true },
    { v: 'league', l: '⚔️ War Room', needsConfig: true },
    { v: 'assistant', l: '🤖 Assistant', needsConfig: true },
  ]

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0f1f18_0%,#020617_55%)] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-lg shadow-lg shadow-emerald-600/30">⚽</span>
            <div>
              <h1 className="text-base font-extrabold leading-tight tracking-tight">Fantasy Coach <span className="text-emerald-400">Premier League</span></h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">
                {overview?.seasonLabel ?? (fixtures ? '…' : '…')} • Données réelles FPL
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {overview?.live && overview.live.remaining > 0 && (
              <Badge className="animate-pulse border-red-500/50 bg-red-500/15 text-red-300">
                🔴 LIVE J{overview.live.gw} : {overview.live.points} pts
              </Badge>
            )}
            {configured && overview && (
              <>
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Journée {nextGw}</Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-300">💰 {overview.me.bank.toFixed(1).replace('.', ',')}M</Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-300">🔄 {overview.me.transfersLeft}{overview.me.transfersExact ? '' : '~'}</Badge>
                {overview.me.rank > 0 && (
                  <Badge variant="outline" className={cn('border-slate-700', overview.me.rank <= 2 ? 'text-amber-300' : 'text-slate-300')}>🏆 {overview.me.rank}<sup>e</sup>/{overview.me.leagueSize || 5}</Badge>
                )}
                {alertCounts && alertCounts.danger > 0 && (
                  <Badge className="border-red-500/50 bg-red-500/15 text-red-300">🚨 {alertCounts.danger + alertCounts.warning}</Badge>
                )}
              </>
            )}
            <button
              onClick={() => setSetupOpen(true)}
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-emerald-500/60 hover:text-emerald-300"
              title="Connecter / changer mes données réelles"
            >
              ⚙️ {configured ? 'Réglages' : 'Connecter'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 pb-16">
        {phase === 'setup' && (
          <div className="mx-auto mb-6 max-w-2xl rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/50 to-slate-900/60 p-6 text-center">
            <div className="text-3xl">🔌</div>
            <h2 className="mt-2 text-lg font-bold text-emerald-300">Connecte ton équipe réelle</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Ce copilote fonctionne <b>exclusivement avec des données réelles</b> : ton équipe FPL, ta ligue privée à 5, les stats officielles des 658 joueurs PL et le vrai calendrier.
              Entrez tes deux IDs publics une seule fois — <b>aucun mot de passe</b>, tout vient de l&apos;API officielle Fantasy Premier League.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              En attendant, les onglets <b>📊 Joueurs</b> et <b>📅 Calendrier</b> explorent déjà les vraies données.
            </p>
            <button onClick={() => setSetupOpen(true)} className="mt-4 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500">
              Connecter mon équipe (Team ID + League ID)
            </button>
          </div>
        )}

        {error && phase === 'ready' && (
          <div className="mx-auto mb-4 max-w-md rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-center">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {phase !== 'setup' && (!players || !fixtures || (configured && !overview)) && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl bg-slate-900" />)}</div>
            <Skeleton className="h-72 rounded-xl bg-slate-900" />
          </div>
        )}

        {players && fixtures && (phase === 'setup' || overview) && (
          <Tabs value={phase === 'setup' ? (tab === 'players' || tab === 'calendar' ? tab : 'players') : tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
              {tabs.filter((t) => phase === 'ready' || !t.needsConfig).map((t) => (
                <TabsTrigger key={t.v} value={t.v} className="rounded-lg px-3 py-1.5 text-xs font-medium data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:text-sm">
                  {t.l}
                  {t.v === 'alerts' && alertCounts && (alertCounts.danger > 0 || alertCounts.warning > 0) && (
                    <span className="ml-1 rounded-full bg-red-500/80 px-1.5 text-[9px] font-bold text-white">{alertCounts.danger + alertCounts.warning}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {phase === 'ready' && overview && (
              <>
                <TabsContent value="team"><TeamTab data={overview} onSelect={onSelect} /></TabsContent>
                <TabsContent value="transfers"><TransfersTab data={overview} onSelect={onSelect} /></TabsContent>
                <TabsContent value="alerts"><AlertsTab alerts={overview.alerts} onSelect={onSelect} /></TabsContent>
                {league && <TabsContent value="league"><LeagueTab league={league} onSelect={onSelect} /></TabsContent>}
                <TabsContent value="assistant"><AssistantTab nextGw={nextGw} /></TabsContent>
              </>
            )}
            <TabsContent value="players"><PlayersTab players={players} onSelect={onSelect} /></TabsContent>
            <TabsContent value="calendar"><FixturesTab teams={fixtures.teams} /></TabsContent>
          </Tabs>
        )}
      </main>

      <footer className="border-t border-slate-800/70 py-4">
        <div className="mx-auto max-w-7xl px-4 text-center text-[11px] text-slate-600">
          Fantasy Coach • Copilote personnel d&apos;aide à la décision • <span className="text-slate-500">Données 100% réelles : API officielle Fantasy Premier League</span>
          {syncTime && <> • Synchro à {syncTime}</>}
        </div>
      </footer>

      <PlayerDialog player={selected} open={!!selected} onClose={() => setSelected(null)} nextGw={nextGw} />
      <SetupDialog open={setupOpen} onOpenChange={setSetupOpen} onSaved={refreshAll} />
    </div>
  )
}
