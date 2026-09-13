'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { OverviewPayload } from '@/lib/coach/types'
import { ScoreRing, StatusDot, TrendArrow, VerdictBadge, fmt } from './ui-helpers'
import type { SquadEntry } from '@/lib/coach/types'

function PlayerChip({ entry, onSelect }: { entry: SquadEntry; onSelect: (id: string) => void }) {
  const p = entry.player
  const proj = p.status === 'FIT' || p.status === 'DOUBTFUL' ? p.projection : 0
  const projCls = proj >= 7 ? 'text-emerald-400' : proj >= 6 ? 'text-amber-300' : proj > 0 ? 'text-orange-300' : 'text-red-400'
  return (
    <button
      onClick={() => onSelect(p.id)}
      className="group w-[104px] rounded-lg border border-slate-700/70 bg-slate-900/90 p-1.5 text-center shadow transition hover:border-emerald-500/60 hover:shadow-emerald-500/10 sm:w-[118px]"
    >
      <div className="flex items-center justify-center gap-1">
        {entry.isCaptain && <span title="Capitaine">🧢</span>}
        <StatusDot status={p.status} />
        <span className="truncate text-[11px] font-semibold text-slate-100">{p.name}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] text-slate-400">
        <span>{p.teamShort}</span>
        <TrendArrow trend={p.trend} />
        <span>{fmt(p.price)}M</span>
      </div>
      <div className={`text-xs font-bold ${projCls}`}>{fmt(proj)}</div>
    </button>
  )
}

function Row({ entries, onSelect }: { entries: SquadEntry[]; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-start justify-center gap-1.5 sm:gap-2.5">
      {entries.map((e) => <PlayerChip key={e.slot} entry={e} onSelect={onSelect} />)}
    </div>
  )
}

export function TeamTab({ data, onSelect }: { data: OverviewPayload; onSelect: (id: string) => void }) {
  const me = data.me
  const byLine = (pos: string) => me.starters.filter((s) => s.player.position === pos)
  const gk = byLine('GK')
  const defs = byLine('DEF')
  const mids = byLine('MID')
  const fwds = byLine('FWD')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardContent className="flex items-center gap-3 p-4">
            <ScoreRing score={me.squadScore} />
            <div>
              <div className="text-xs text-slate-400">Note globale</div>
              <div className="text-sm font-semibold text-slate-100">{me.rank}<sup>e</sup> / {me.leagueSize || 5} au classement</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/60"><CardContent className="p-4"><div className="text-xs text-slate-400">Budget en banque</div><div className="text-2xl font-bold text-emerald-400">{fmt(me.bank)}M</div><div className="text-xs text-slate-500">Valeur équipe : {fmt(me.teamValue)}M</div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-900/60"><CardContent className="p-4"><div className="text-xs text-slate-400">Transferts restants</div><div className="text-2xl font-bold text-slate-100">{me.transfersLeft}{!me.transfersExact && <span className="text-sm text-slate-500"> ~</span>}</div><div className="text-xs text-slate-500">Journée {data.nextGw} à venir{!me.transfersExact && ' (estimation — ajoute ton cookie pour l’exact)'}</div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-900/60"><CardContent className="p-4"><div className="text-xs text-slate-400">Points (saison)</div><div className="text-2xl font-bold text-slate-100">{me.totalPoints}</div><div className="text-xs text-slate-500">{data.live ? `🔴 J${data.live.gw} en cours : ${data.live.points} pts (${data.live.remaining} match(s) à jouer)` : `Proj. J${data.nextGw} : ~${me.projectedGwPoints} pts`}</div></CardContent></Card>
        <Card className="col-span-2 border-slate-800 bg-slate-900/60 sm:col-span-1 lg:col-span-2">
          <CardContent className="p-4">
            <div className="text-xs text-slate-400">🧢 Capitaine</div>
            {me.captainSuggestion ? (
              <div className="mt-1 space-y-1">
                <div className="text-sm text-slate-300">Actuel : <span className="font-semibold">{me.starters.find((s) => s.isCaptain)?.player.name}</span></div>
                <div className="text-sm text-emerald-300">→ Moteur : <span className="font-bold">{me.captainSuggestion.name}</span> (proj. {fmt(me.captainSuggestion.projection)})</div>
              </div>
            ) : (
              <div className="mt-1 text-sm text-slate-300">{me.starters.find((s) => s.isCaptain)?.player.name} — choix optimal ✅</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-gradient-to-b from-emerald-950/40 via-slate-900/60 to-slate-900/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base text-slate-200">
            <span>{me.teamName} — XI titrant (J{data.nextGw})</span>
            <span className="text-xs font-normal text-slate-400">Clique un joueur pour l&apos;analyse complète</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Row entries={fwds} onSelect={onSelect} />
          <Row entries={mids} onSelect={onSelect} />
          <Row entries={defs} onSelect={onSelect} />
          <Row entries={gk} onSelect={onSelect} />
          <div className="border-t border-slate-800 pt-3">
            <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">Banc</div>
            <Row entries={me.bench} onSelect={onSelect} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">⚠️ Maillots faibles du XI</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {me.weakestStarters.map((w) => (
              <button key={w.name} onClick={() => onSelect(me.starters.find((s) => s.player.name === w.name)!.player.id)} className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-left transition hover:border-emerald-500/50">
                <div>
                  <div className="text-sm font-semibold text-slate-200">{w.name}</div>
                  <div className="text-xs text-slate-500">{w.reason}</div>
                </div>
                <div className="flex items-center gap-2">
                  <VerdictBadge verdict={w.verdict} compact />
                  <span className={`text-sm font-bold ${w.projection >= 6.5 ? 'text-amber-300' : 'text-red-400'}`}>{fmt(w.projection)}</span>
                </div>
              </button>
            ))}
            {me.weakestStarters.length === 0 && <div className="text-sm text-slate-500">Aucun point faible détecté 💪</div>}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">💎 Mouvements suggérés ({me.transfersLeft} transfert{me.transfersLeft > 1 ? 's' : ''})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.transfers.sell.slice(0, 2).map((s) => (
              <div key={s.player.id} className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">Vendre : {s.player.name} <Badge variant="outline" className="ml-1 border-slate-700 text-[10px] text-slate-400">{fmt(s.player.price)}M</Badge></span>
                </div>
                <div className="text-xs text-slate-500">{s.reason}</div>
              </div>
            ))}
            {data.transfers.buy.slice(0, 2).map((b) => (
              <button key={b.player.id} onClick={() => onSelect(b.player.id)} className="w-full rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-left transition hover:border-emerald-500/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">Acheter : {b.player.name} <Badge variant="outline" className="ml-1 border-slate-700 text-[10px] text-slate-400">{fmt(b.player.price)}M</Badge></span>
                  {b.netGain !== null && <span className="text-xs font-bold text-emerald-400">+{fmt(b.netGain)} proj.</span>}
                </div>
                <div className="text-xs text-slate-500">{b.justification}</div>
              </button>
            ))}
            {data.transfers.sell.length === 0 && data.transfers.buy.length === 0 && (
              <div className="text-sm text-slate-500">Ton équipe est bien calibrée — garde tes transferts. 🧊</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
