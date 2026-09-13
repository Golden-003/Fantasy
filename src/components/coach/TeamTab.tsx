'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { CaptainPick, SquadPlayerView, TeamView, TransferFlag } from '@/lib/coach/types'
import { ConfirmBadge, DiffBadge, Own, PlayerAvatar, PosBadge, POS_LABEL, Price, SourceChip } from './ui-helpers'
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'

const FLAG_ICON: Record<TransferFlag['kind'], typeof Shield> = {
  SURVEILLER: ShieldAlert,
  GARDER: ShieldCheck,
  DOUTE: Shield,
}
const FLAG_STYLE: Record<TransferFlag['kind'], string> = {
  SURVEILLER: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
  GARDER: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
  DOUTE: 'border-sky-500/30 bg-sky-500/5 text-sky-300',
}

function PointsChip({ p }: { p: SquadPlayerView }) {
  if (p.pointsR4 == null) {
    return (
      <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300" title={p.pointsNote ?? undefined}>
        R4 ?
      </span>
    )
  }
  return (
    <span className={`rounded-md px-2 py-0.5 text-sm font-black tabular-nums ${p.pointsR4 >= 10 ? 'bg-emerald-500/20 text-emerald-300' : p.pointsR4 >= 6 ? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-500/20 text-zinc-300'}`}>
      {p.pointsR4}
    </span>
  )
}

function PitchPlayer({ p, onOpen }: { p: SquadPlayerView; onOpen: (p: SquadPlayerView) => void }) {
  return (
    <button onClick={() => onOpen(p)} className="group flex w-24 flex-col items-center gap-1 sm:w-28">
      <div className="relative">
        <PlayerAvatar name={p.name} />
        {p.captain && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-black shadow">C</span>
        )}
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2"><PosBadge pos={p.position} /></span>
      </div>
      <p className="mt-1.5 w-full truncate rounded bg-black/50 px-1 text-center text-[11px] font-semibold text-white">{p.name}</p>
      <p className="text-[9px] text-zinc-400">
        {p.clubConfirmed ? p.club : <span className="text-amber-300">{p.club} ?</span>}
      </p>
      <PointsChip p={p} />
    </button>
  )
}

export default function TeamTab() {
  const [team, setTeam] = useState<TeamView | null>(null)
  const [caps, setCaps] = useState<CaptainPick[]>([])
  const [flags, setFlags] = useState<TransferFlag[]>([])
  const [sel, setSel] = useState<SquadPlayerView | null>(null)

  useEffect(() => {
    fetch('/api/coach/team')
      .then((r) => r.json())
      .then((d) => {
        setTeam(d.team)
        setCaps(d.captains ?? [])
        setFlags(d.flags ?? [])
      })
      .catch(console.error)
  }, [])

  if (!team) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const row = (pos: SquadPlayerView['position']) => team.starters.filter((p) => p.position === pos)

  return (
    <div className="space-y-4">
      {/* Terrain */}
      <Card className="overflow-hidden border-emerald-900/40">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Mon équipe réelle — Vital_GDB</CardTitle>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-300">{team.formation}</span>
              <span>R4 · 71 pts (capture 13 sept)</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="rounded-xl bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.16),rgba(2,44,34,0.5))] p-4 ring-1 ring-emerald-800/40">
            <div className="space-y-5">
              <div className="flex justify-center gap-3 sm:gap-5">{row('G').map((p) => <PitchPlayer key={p.id} p={p} onOpen={setSel} />)}</div>
              <div className="flex justify-center gap-2 sm:gap-3">{row('D').map((p) => <PitchPlayer key={p.id} p={p} onOpen={setSel} />)}</div>
              <div className="flex justify-center gap-1.5 sm:gap-2">{row('M').map((p) => <PitchPlayer key={p.id} p={p} onOpen={setSel} />)}</div>
              <div className="flex justify-center gap-3 sm:gap-5">{row('A').map((p) => <PitchPlayer key={p.id} p={p} onOpen={setSel} />)}</div>
            </div>
            <div className="mt-6 border-t border-emerald-800/40 pt-4">
              <p className="mb-2 text-center text-[10px] uppercase tracking-widest text-emerald-300/70">Banc</p>
              <div className="flex flex-wrap justify-center gap-3 sm:gap-5">
                {team.bench.map((p) => <PitchPlayer key={p.id} p={p} onOpen={setSel} />)}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
            <span>Budget confirmé : <b className="text-zinc-200">{team.knownSpend.toFixed(1).replace('.', ',')} M€</b> ({team.knownPriceCount}/15 joueurs sourcés)</span>
            <span className="text-amber-300/90">{team.unknownPriceCount.length} prix à confirmer dans l’app</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Historique réel : R1 71 · R2 66 · R3 76 · R4 71 → 284 pts. Contrôle croisé avec le classement officiel ✓
          </p>
        </CardContent>
      </Card>

      {/* Vigilance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vigilance effectif — signaux réels</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {flags.map((f) => {
            const Icon = FLAG_ICON[f.kind]
            return (
              <div key={f.playerId} className={`rounded-lg border p-3 ${FLAG_STYLE[f.kind]}`}>
                <p className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 shrink-0" /> {f.kind} · {f.name}</p>
                <p className="mt-1 text-xs text-zinc-300">{f.reason}</p>
                <p className="mt-1 text-[10px] text-zinc-500">Source : {f.source}</p>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Détail joueur */}
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-md">
          {sel && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PlayerAvatar name={sel.name} size="sm" /> {sel.name} {sel.captain && <span className="rounded bg-amber-400 px-1.5 text-xs font-black text-black">C</span>}
                </DialogTitle>
                <DialogDescription>
                  {POS_LABEL[sel.position]} · {sel.club} {!sel.clubConfirmed && <ConfirmBadge label="club à confirmer" />}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-border bg-zinc-900/40 p-2">
                    <p className="text-[10px] uppercase text-zinc-500">R4 (capture)</p>
                    <p className="text-lg font-bold">{sel.pointsR4 ?? '?'}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-zinc-900/40 p-2">
                    <p className="text-[10px] uppercase text-zinc-500">Prix</p>
                    <p className="text-sm font-bold"><Price value={sel.price} /></p>
                  </div>
                  <div className="rounded-lg border border-border bg-zinc-900/40 p-2">
                    <p className="text-[10px] uppercase text-zinc-500">Détention</p>
                    <p className="text-sm font-bold"><Own value={sel.ownership} /></p>
                  </div>
                </div>
                {sel.pointsNote && <p className="text-xs text-amber-300/90">⚠️ {sel.pointsNote}</p>}
                {sel.formNote && <p className="text-xs text-emerald-300/90">📈 Forme officielle : {sel.formNote}</p>}
                {sel.fixtureR5 && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-zinc-900/40 p-2 text-xs">
                    <span className="text-zinc-400">Fixture R5 :</span>
                    <span className="font-semibold">{sel.fixtureR5.isHome ? 'vs' : '@'} {sel.fixtureR5.opponent}</span>
                    <DiffBadge difficulty={sel.fixtureR5.difficulty} />
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <SourceChip source={sel.priceSource ?? 'Captures de ton app (13 sept 2026)'} />
                </div>
                {caps.find((c) => c.playerId === sel.id) && (
                  <p className="text-xs text-violet-300">🧢 Suggestion capitaine R5 n°{caps.find((c) => c.playerId === sel.id)!.rank} — {caps.find((c) => c.playerId === sel.id)!.reasons.join(' · ')}</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
