'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { LeagueData, RivalAnalysis } from '@/lib/coach/types'
import { ScoreRing, VerdictBadge, fmt } from './ui-helpers'

const THREAT: Record<RivalAnalysis['threatLevel'], { cls: string; label: string }> = {
  HIGH: { cls: 'border-red-500/40 bg-red-500/15 text-red-300', label: '🔴 Menace élevée' },
  MEDIUM: { cls: 'border-amber-500/40 bg-amber-500/15 text-amber-300', label: '🟠 Menace moyenne' },
  LOW: { cls: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300', label: '🟢 Sous contrôle' },
}

export function LeagueTab({ league, onSelect }: { league: LeagueData; onSelect: (id?: string) => void }) {
  return (
    <div className="space-y-4">
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">🏆 Classement de la ligue privée</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="w-10">#</TableHead>
                <TableHead>Équipe</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Score équipe</TableHead>
                <TableHead className="text-right">Proj. J</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {league.standings.map((s) => (
                <TableRow key={s.teamName} className={`border-slate-800/70 ${s.isMine ? 'bg-emerald-500/5' : ''}`}>
                  <TableCell className={`font-bold ${s.rank === 1 ? 'text-amber-400' : 'text-slate-400'}`}>{s.rank === 1 ? '👑' : s.rank}</TableCell>
                  <TableCell className={s.isMine ? 'font-semibold text-emerald-300' : 'text-slate-200'}>{s.teamName} {s.isMine && <span className="text-[10px] text-emerald-400">(toi)</span>}</TableCell>
                  <TableCell className="text-sm text-slate-400">{s.ownerName}</TableCell>
                  <TableCell className="text-right font-semibold text-slate-200">{s.totalPoints}</TableCell>
                  <TableCell className="text-right"><span className={s.squadScore >= league.myScore ? 'text-red-300' : 'text-slate-400'}>{s.squadScore}</span></TableCell>
                  <TableCell className="text-right text-slate-300">~{s.projectedGwPoints}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {league.rivals.map((r) => (
          <Card key={r.ownerName} className="border-slate-800 bg-slate-900/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm text-slate-200">
                <span>{r.teamName} <span className="text-xs font-normal text-slate-500">• {r.ownerName}</span></span>
                <Badge variant="outline" className={THREAT[r.threatLevel].cls}>{THREAT[r.threatLevel].label}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <ScoreRing score={r.squadScore} size={56} />
                <div className="text-xs text-slate-400">
                  <div>{r.totalPoints} pts • proj. J ~{r.projectedGwPoints}</div>
                  <div>{r.overlap} joueur(s) en commun avec toi</div>
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Menaces principales (hors ton équipe)</div>
                <div className="flex flex-wrap gap-1.5">
                  {r.threats.map((t) => (
                    <span key={t.name} className="rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-slate-300">
                      <span className="font-semibold text-slate-100">{t.name}</span> · {fmt(t.projection)} · {fmt(t.price)}M
                    </span>
                  ))}
                  {r.threats.length === 0 && <span className="text-xs text-slate-500">Ses meilleurs joueurs sont déjà chez toi 😏</span>}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-xs text-slate-300">💡 {r.advice}</div>
              <details className="text-xs text-slate-400">
                <summary className="cursor-pointer select-none hover:text-slate-200">Voir son effectif ({r.squad.length} joueurs)</summary>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.squad.map((p) => (
                    <span key={p.name} className="inline-flex items-center gap-1 rounded border border-slate-700/60 bg-slate-950/60 px-1.5 py-0.5 text-[10px] text-slate-300">
                      {p.isCaptain && '🧢'} {p.name} <span className="text-slate-500">{fmt(p.projection)}</span> <VerdictBadge verdict={p.verdict} compact />
                    </span>
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-purple-300">💎 Differential Finder — joueurs que aucun rival ne possède</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {league.differentials.map((p) => (
              <button key={p.id} onClick={() => onSelect(p.id)} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-left transition hover:border-purple-400/50">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{p.name} <span className="text-xs font-normal text-slate-500">{p.teamShort} • {fmt(p.price)}M</span></div>
                  <div className="text-[11px] text-slate-500">Possession {fmt(p.ownership)}% • Calendrier {Math.round(p.fixtureScore)}/100</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-purple-300">{fmt(p.projection)}</span>
                  <VerdictBadge verdict={p.verdict} compact />
                </div>
              </button>
            ))}
            {league.differentials.length === 0 && <span className="text-sm text-slate-500">Aucun différentiel exploitable cette semaine.</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
