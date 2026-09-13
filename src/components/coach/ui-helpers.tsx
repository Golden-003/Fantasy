'use client'

import { Badge } from '@/components/ui/badge'
import type { Verdict } from '@/lib/coach/types'
import { cn } from '@/lib/utils'

export const VERDICT_META: Record<Verdict, { emoji: string; label: string; cls: string }> = {
  GREEN: { emoji: '🟢', label: 'Bon investissement', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  YELLOW: { emoji: '🟡', label: 'À surveiller', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  RED: { emoji: '🔴', label: 'À éviter', cls: 'bg-red-500/15 text-red-300 border-red-500/40' },
}

export function VerdictBadge({ verdict, compact = false }: { verdict: Verdict; compact?: boolean }) {
  const m = VERDICT_META[verdict]
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', m.cls)}>
      {m.emoji} {compact ? '' : m.label}
    </Badge>
  )
}

export const DIFF_CLS: Record<number, string> = {
  1: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  2: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/25',
  3: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  4: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  5: 'bg-red-500/20 text-red-300 border-red-500/45',
}

export function DifficultyChip({ d }: { d: number }) {
  return (
    <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 text-[10px] font-bold', DIFF_CLS[d] ?? DIFF_CLS[3])} title={`Difficulté ${d}/5`}>
      {d}
    </span>
  )
}

export function FixtureChips({ fixtures }: { fixtures: { gw: number; opp: string; venue: 'H' | 'A'; difficulty: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {fixtures.map((f) => (
        <span key={f.gw} className="inline-flex items-center gap-0.5 rounded-md border border-slate-700/60 bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300">
          <span className="text-slate-500">J{f.gw}</span> {f.opp}{f.venue === 'A' && <span className="text-slate-500">@</span>} <DifficultyChip d={f.difficulty} />
        </span>
      ))}
      {fixtures.length === 0 && <span className="text-xs text-slate-500">—</span>}
    </div>
  )
}

export function TrendArrow({ trend }: { trend: 'UP' | 'DOWN' | 'STABLE' }) {
  if (trend === 'UP') return <span className="text-emerald-400" title="En progression">▲</span>
  if (trend === 'DOWN') return <span className="text-red-400" title="En baisse">▼</span>
  return <span className="text-slate-500" title="Stable">▬</span>
}

export const POS_CLS: Record<string, string> = {
  GK: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  DEF: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  MID: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  FWD: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

export function PositionBadge({ pos }: { pos: string }) {
  return <Badge variant="outline" className={cn('w-12 justify-center text-[10px] font-bold', POS_CLS[pos])}>{pos}</Badge>
}

export function StatusDot({ status }: { status: string }) {
  if (status === 'FIT') return null
  const map: Record<string, { c: string; t: string }> = {
    INJURED: { c: 'bg-red-500', t: 'Blessé' },
    SUSPENDED: { c: 'bg-red-400', t: 'Suspendu' },
    DOUBTFUL: { c: 'bg-amber-400', t: 'Incertitude physique' },
  }
  const m = map[status]
  return <span className={cn('inline-block h-2 w-2 rounded-full', m?.c)} title={m?.t ?? status} />
}

export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const color = score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-full border-2', color, size === 64 ? 'h-16 w-16' : 'h-14 w-14')} style={{ borderColor: 'currentColor' }}>
      <span className={cn('font-extrabold', size === 64 ? 'text-xl' : 'text-lg')}>{score}</span>
      <span className="text-[9px] uppercase tracking-wide text-slate-400">score</span>
    </div>
  )
}

export const fmt = (n: number) => n.toFixed(1).replace('.', ',')
