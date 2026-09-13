'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { PlayerRow } from '@/lib/coach/types'
import { DifficultyChip, FixtureChips, PositionBadge, StatusDot, TrendArrow, VerdictBadge, fmt } from './ui-helpers'

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
      <div className="text-sm font-bold text-slate-100">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}

export function PlayerDialog({ player, open, onClose, nextGw }: { player: PlayerRow | null; open: boolean; onClose: () => void; nextGw: number }) {
  if (!player) return null
  const s = player.stats
  const isGk = player.position === 'GK'
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
            <StatusDot status={player.status} />
            <span>{player.name}</span>
            <PositionBadge pos={player.position} />
            <span className="text-sm font-normal text-slate-400">{player.teamName}</span>
            <VerdictBadge verdict={player.verdict} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCell label="Prix" value={`${fmt(player.price)}M`} />
          <StatCell label="Pts / match" value={fmt(player.rating)} />
          <StatCell label="Forme (5 j.)" value={fmt(player.form)} />
          <StatCell label="Projection J" value={player.status === 'FIT' || player.status === 'DOUBTFUL' ? fmt(player.projection) : '0,0'} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Badge variant="outline" className="border-slate-700 text-slate-300">Possession FPL : {fmt(player.ownership)}%</Badge>
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Ép_next officiel J+1 : {fmt(player.epNext)}</Badge>
          <Badge variant="outline" className="border-slate-700 text-slate-300">Minutes : {player.minutesPct}%</Badge>
          <Badge variant="outline" className="border-slate-700 text-slate-300">Rotation : {player.rotationRisk === 'LOW' ? 'faible' : player.rotationRisk === 'MEDIUM' ? 'moyenne' : 'élevée'}</Badge>
          <Badge variant="outline" className="border-slate-700 text-slate-300">Tendance <TrendArrow trend={player.trend} /></Badge>
          {player.injuryNote && <Badge className="border-red-500/40 bg-red-500/15 text-red-300">{player.injuryNote}</Badge>}
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Verdict du moteur</div>
          <ul className="space-y-1">
            {player.reasons.map((r, i) => (
              <li key={i} className="rounded-md bg-slate-900/70 px-3 py-1.5 text-sm text-slate-300">{r}</li>
            ))}
          </ul>
        </div>

        <Separator className="bg-slate-800" />

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Calendrier — 5 prochaines journées (Fixture Score : {Math.round(player.fixtureScore)}/100)</div>
          <FixtureChips fixtures={player.fixtures} />
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">5 derniers matchs</div>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">J</th>
                  <th className="px-2 py-1.5 text-left font-medium">Adv.</th>
                  <th className="px-2 py-1.5 text-right font-medium" title="Note BPS FPL : 4 + bps/10 (max 10)">Note*</th>
                  <th className="px-2 py-1.5 text-right font-medium">Min.</th>
                  <th className="px-2 py-1.5 text-right font-medium">B</th>
                  <th className="px-2 py-1.5 text-right font-medium">P</th>
                </tr>
              </thead>
              <tbody>
                {player.last5.map((m, i) => (
                  <tr key={i} className="border-t border-slate-800/70">
                    <td className="px-2 py-1.5 text-slate-400">J{m.gw}</td>
                    <td className="px-2 py-1.5 text-slate-300">{m.oppShort}{m.venue === 'A' ? ' (@)' : ''}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold ${m.rating >= 7.5 ? 'text-emerald-400' : m.rating >= 6.8 ? 'text-slate-200' : 'text-amber-400'}`}>{fmt(m.rating)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-300">{m.minutes}&apos;</td>
                    <td className="px-2 py-1.5 text-right text-slate-300">{m.goals || '–'}</td>
                    <td className="px-2 py-1.5 text-right text-slate-300">{m.assists || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Statistiques saison (officielles FPL)</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <StatCell label="Titularisations" value={s.starts} />
            <StatCell label="Minutes" value={s.minutes} />
            {!isGk && <StatCell label="Buts" value={s.goals} />}
            {!isGk && <StatCell label="Passes dé." value={s.assists} />}
            {!isGk && <StatCell label="xG" value={fmt(s.xg)} />}
            {!isGk && <StatCell label="xA" value={fmt(s.xa)} />}
            {!isGk && <StatCell label="xGI" value={fmt(s.xgi)} />}
            <StatCell label="Clean sheets" value={s.cleanSheets} />
            {isGk && <StatCell label="Arrêts" value={s.saves} />}
            <StatCell label="Bonus" value={s.bonus} />
            <StatCell label="BPS" value={s.bps} />
            <StatCell label="Tacles" value={s.tackles} />
            <StatCell label="Dég.+Int." value={s.cbi} />
            <StatCell label="Ballons réc." value={s.recoveries} />
            <StatCell label="Cartons J/R" value={`${s.yellow}/${s.red}`} />
          </div>
        </div>

        <div className="text-[11px] leading-relaxed text-slate-500">Journée suivante : J{nextGw} • Fixture Score = qualité du calendrier sur 5 journées (0-100, FDR officielle FPL). * Note = 4 + BPS/10 (plafonnée à 10) — Sofascore ne propose pas d&apos;API publique, la note est donc dérivée du BPS réel FPL.</div>
      </DialogContent>
    </Dialog>
  )
}
