'use client'

import type { Difficulty, PlayerStatus, Pos } from '@/lib/coach/types'

const POS_STYLE: Record<Pos, string> = {
  G: 'bg-amber-100 text-amber-700 border-amber-200',
  D: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  M: 'bg-sky-100 text-sky-700 border-sky-200',
  A: 'bg-rose-100 text-rose-700 border-rose-200',
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
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : difficulty === 'MOYEN'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200'
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${style}`}>
      {difficulty}
    </span>
  )
}

const STATUS_STYLE: Record<PlayerStatus, { label: string; cls: string }> = {
  DISPO: { label: 'Disponible', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  DOUTEUX: { label: 'Incertain', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ABSENT: { label: 'Absent', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
}

export function StatusBadge({ status }: { status: PlayerStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  )
}

export function Price({ value, priceRef }: { value: number | null; priceRef?: number | null }) {
  if (value != null) return <span className="font-semibold tabular-nums">{value.toFixed(1).replace('.', ',')} M€</span>
  if (priceRef != null) return <span className="tabular-nums text-slate-500">réf. {priceRef.toFixed(1).replace('.', ',')} M£</span>
  return <span className="text-slate-400">—</span>
}

export function Own({ value, valueRef }: { value: number | null; valueRef?: number | null }) {
  const v = value ?? valueRef
  if (v == null) return <span className="text-slate-400">—</span>
  return <span className="tabular-nums text-slate-600">{v.toFixed(1).replace('.', ',')} %</span>
}

export function PlayerAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const dim = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-sm'
  return (
    <div className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600 border border-slate-200`}>
      {initials}
    </div>
  )
}

export function fmt(n: number) {
  return n.toLocaleString('fr-FR')
}

export function fr(n: number | null | undefined, digits = 1) {
  if (n == null) return '—'
  return n.toFixed(digits).replace('.', ',')
}
