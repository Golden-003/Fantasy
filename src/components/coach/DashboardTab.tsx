'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Alert, CaptainPick, Overview } from '@/lib/coach/types'
import { ROUND_DATES, RULES } from '@/lib/coach/rules'
import { fmt } from './ui-helpers'
import { ArrowDown, ArrowUp, Crown, Flame, Info, TriangleAlert, CalendarDays, Repeat2, Wallet } from 'lucide-react'

const LEVEL_STYLE: Record<Alert['level'], { icon: typeof Flame; cls: string; label: string }> = {
  HOT: { icon: Flame, cls: 'border-rose-500/30 bg-rose-500/5 text-rose-300', label: 'CHAUDE' },
  WARN: { icon: TriangleAlert, cls: 'border-amber-500/30 bg-amber-500/5 text-amber-300', label: 'VIGILANCE' },
  INFO: { icon: Info, cls: 'border-sky-500/30 bg-sky-500/5 text-sky-300', label: 'INFO' },
}

export default function DashboardTab({ onGoAssistant }: { onGoAssistant: () => void }) {
  const [ov, setOv] = useState<Overview | null>(null)
  const [caps, setCaps] = useState<CaptainPick[]>([])

  useEffect(() => {
    fetch('/api/coach/overview').then((r) => r.json()).then(setOv).catch(console.error)
    fetch('/api/coach/team')
      .then((r) => r.json())
      .then((d) => setCaps(d.captains ?? []))
      .catch(console.error)
  }, [])

  if (!ov) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hero classement */}
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-950/60 via-card to-card">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-violet-300/80">{ov.leagueName} · {ov.season}</p>
              <p className="mt-1 text-4xl font-black leading-none">
                {ov.myRank}<span className="text-lg text-zinc-400 font-bold">ᵉ / 5</span>
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                {fmt(ov.myTotal)} pts · R5 le <span className="text-violet-300 font-semibold">{ov.nextRoundDate}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-center">
                <p className="flex items-center gap-1 text-[10px] uppercase text-rose-300"><ArrowDown className="h-3 w-3" /> Leader</p>
                <p className="text-lg font-bold text-rose-200">{ov.gapToLeader}</p>
              </div>
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-center">
                <p className="flex items-center gap-1 text-[10px] uppercase text-emerald-300"><ArrowUp className="h-3 w-3" /> Dernier</p>
                <p className="text-lg font-bold text-emerald-200">+{ov.gapToLast}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* R5 : capitaine + transferts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-amber-300" /> Capitaine R5 — suggestions moteur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {caps.slice(0, 3).map((c) => (
              <div key={c.playerId} className="rounded-lg border border-border bg-zinc-900/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 text-xs font-bold text-amber-300">{c.rank}</span>
                    {c.name}
                  </p>
                  <span className="text-xs text-zinc-400">{c.fixture}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{c.reasons.slice(0, 2).join(' · ')}</p>
              </div>
            ))}
            <p className="text-[11px] text-zinc-500">Classement transparent : points réels R4 + note de forme officielle + difficulté de fixture estimée.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Repeat2 className="h-4 w-4 text-violet-300" /> Avant la clôture R5
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-zinc-400" />
              <span>Clôture : <b>{ROUND_DATES[5]}</b></span>
            </div>
            <div className="flex items-center gap-2">
              <Repeat2 className="h-4 w-4 text-zinc-400" />
              <span><b>{RULES.freeTransfersPerRound} transferts gratuits</b> (cumul max {RULES.transferBankMax}, extra −{RULES.extraTransferPenalty} pts)</span>
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-zinc-400" />
              <span>Budget confirmé : <b>{ov.budget.knownSpend.toFixed(1).replace('.', ',')} M€</b> sur {ov.budget.knownCount} joueurs · {ov.budget.unknownCount} prix <span className="text-amber-300">à confirmer</span></span>
            </div>
            <button
              onClick={onGoAssistant}
              className="mt-1 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Demander à l&apos;assistant IA
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Alertes réelles */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Alertes — faits réels uniquement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ov.alerts.map((a, i) => {
            const st = LEVEL_STYLE[a.level]
            const Icon = st.icon
            return (
              <div key={i} className={`rounded-lg border p-3 ${st.cls}`}>
                <p className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 shrink-0" /> {a.title}</p>
                <p className="mt-1 text-xs text-zinc-300">{a.detail}</p>
                <p className="mt-1 text-[10px] text-zinc-500">Source : {a.source}</p>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Transparence données */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs text-zinc-400">
          <span>Base de données réelle : <b className="text-zinc-200">{ov.dataQuality.playersTracked} joueurs</b> suivis · <b className="text-zinc-200">{ov.dataQuality.pricesSourced}</b> prix sourcés · <b className="text-zinc-200">{ov.dataQuality.fixturesSourced}</b> fixtures officielles · <b className="text-zinc-200">{ov.dataQuality.dataEvents}</b> événements tracés</span>
          <span className="text-violet-300/80">Zéro donnée inventée — chaque chiffre porte sa source.</span>
        </CardContent>
      </Card>
    </div>
  )
}
