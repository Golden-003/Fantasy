'use client'

import { Badge } from '@/components/ui/badge'
import type { Difficulty, Pos } from '@/lib/coach/types'
import { Paperclip, AlertTriangle } from 'lucide-react'

export function SourceChip({ source, className = '' }: { source?: string | null; className?: string }) {
  if (!source) return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 text-[10px] leading-tight text-violet-300 ${className}`}
      title={`Source réelle : ${source}`}
    >
      <Paperclip className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate max-w-[180px]">{source}</span>
    </span>
  )
}

export function ConfirmBadge({ label = 'à confirmer' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 whitespace-nowrap">
      <AlertTriangle className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

const POS_STYLE: Record<Pos, string> = {
  G: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  D: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  M: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
  A: 'bg-rose-400/15 text-rose-300 border-rose-400/30',
}
export const POS_LABEL: Record<Pos, string> = { G: 'Gardien', D: 'Défenseur', M: 'Milieu', A: 'Attaquant' }

export function PosBadge({ pos }: { pos: Pos }) {
  return (
    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 text-[10px] font-bold ${POS_STYLE[pos]}`}>
      {pos}
    </span>
  )
}

export function DiffBadge({ difficulty }: { difficulty: Difficulty }) {
  const style =
    difficulty === 'FACILE'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : difficulty === 'MOYEN'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : difficulty === 'DIFFICILE'
          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
  return <Badge variant="outline" className={`text-[10px] px-1.5 ${style}`}>{difficulty}</Badge>
}

export function Price({ value }: { value: number | null }) {
  if (value == null) return <ConfirmBadge label="prix ?" />
  return <span className="font-semibold tabular-nums">{value.toFixed(1).replace('.', ',')} M€</span>
}

export function Own({ value }: { value: number | null }) {
  if (value == null) return <span className="text-zinc-500 text-xs">—</span>
  return <span className="tabular-nums text-zinc-300">{value.toFixed(1).replace('.', ',')} %</span>
}

export function PlayerAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const dim = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-11 w-11 text-sm'
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-violet-500/40 to-fuchsia-500/20 border border-violet-400/30 flex items-center justify-center font-bold text-violet-100 shrink-0`}>
      {initials}
    </div>
  )
}

export function fmt(n: number) {
  return n.toLocaleString('fr-FR')
}
