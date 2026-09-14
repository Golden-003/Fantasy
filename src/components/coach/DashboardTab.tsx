'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DiffBadge } from '@/components/coach/ui-helpers'
import type { Overview } from '@/lib/coach/types'
import {
  AlertTriangle, ArrowUpRight, CalendarDays, Crown, Flame, Info, Loader2, RefreshCw, ShieldAlert, Shirt, TrendingUp, Users,
} from 'lucide-react'

const LEVEL_ICON = {
  HOT: { icon: Flame, cls: 'text-rose-600 bg-rose-50' },
  WARN: { icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50' },
  INFO: { icon: Info, cls: 'text-sky-600 bg-sky-50' },
} as const

export default function DashboardTab({ onGoTeam }: { onGoTeam: () => void }) {
  const [ov, setOv] = useState<Overview | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch('/api/coach/overview')
      .then((r) => r.json())
      .then((d) => setOv(d.error ? null : d))
      .catch(() => setOv(null))
    fetch('/api/sync')
      .then((r) => r.json())
      .then((d) => setLastSync(d.lastAt ?? null))
      .catch(() => setLastSync(null))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function refresh() {
    if (syncing) return
    setSyncing(true)
    try {
      await fetch('/api/sync', { method: 'POST' })
      load()
    } catch {
      /* silencieux */
    } finally {
      setSyncing(false)
    }
  }

  if (!ov) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Position */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ov.leagueName} · {ov.season}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-black tabular-nums text-slate-900">{ov.myTotal}</span>
                <span className="text-sm text-slate-500">points · {ov.myRank}<sup>{ov.myRank === 1 ? 'er' : 'e'}</sup> / 5</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Écart leader</p>
                <p className={`font-bold tabular-nums ${ov.gapToLeader < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {ov.gapToLeader > 0 ? '+' : ''}{ov.gapToLeader}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Écart 5ᵉ</p>
                <p className="font-bold tabular-nums text-slate-700">{ov.gapToLast > 0 ? '+' : ''}{ov.gapToLast}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prochaine journée + capitaine */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-slate-400" /> Journée {ov.nextRound}
              {ov.nextRoundDate && <span className="text-xs font-normal text-slate-500">{ov.nextRoundDate}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            2 transferts gratuits · cumul jusqu’à 5 · capitaine ×2
            <button
              onClick={onGoTeam}
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              <Shirt className="h-3.5 w-3.5" /> Gérer mon équipe
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Crown className="h-4 w-4 text-slate-400" /> Capitaine suggéré
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ov.captainTop ? (
              <div>
                <p className="text-lg font-bold text-slate-900">{ov.captainTop.name}</p>
                <p className="text-xs text-slate-500">
                  {ov.captainTop.club} · {ov.captainTop.fixture}
                  {'  '}· score {ov.captainTop.score.toString().replace('.', ',')}
                </p>
                {ov.captainTop.reasons[0] && <p className="mt-1 text-xs text-slate-500">{ov.captainTop.reasons[0]}</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Effectif vide — choisis ton onze</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert className="h-4 w-4 text-slate-400" /> À surveiller
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ov.alerts.map((a, i) => {
            const L = LEVEL_ICON[a.level]
            const Icon = L.icon
            return (
              <div key={i} className="flex gap-3 rounded-lg border border-slate-200 p-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${L.cls}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                  <p className="text-xs leading-relaxed text-slate-500">{a.detail}</p>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Base de données */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm text-slate-600">
          <Users className="h-4 w-4 shrink-0 text-slate-400" />
          <p>
            <b className="tabular-nums text-slate-900">{ov.playerCount}</b> joueurs de Premier League ·{' '}
            <b className="tabular-nums text-slate-900">{ov.fixtureCount}</b> lignes calendrier
            {lastSync && <span className="text-xs text-slate-400"> · maj {new Date(lastSync).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
          <button
            onClick={refresh}
            disabled={syncing}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Actualiser
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

// Réexport pour usage éventuel
export { DiffBadge }
