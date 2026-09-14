'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PosBadge, Price, StatusBadge } from '@/components/coach/ui-helpers'
import type { PlayerRow, Pos } from '@/lib/coach/types'
import { Loader2, Search } from 'lucide-react'

const POSITIONS: (Pos | 'ALL')[] = ['ALL', 'G', 'D', 'M', 'A']

export default function PlayerPickerDialog({
  open,
  onClose,
  onPick,
  positionFilter,
  excludeIds = [],
  title = 'Choisir un joueur',
}: {
  open: boolean
  onClose: () => void
  onPick: (player: PlayerRow) => void
  positionFilter?: Pos
  excludeIds?: string[]
  title?: string
}) {
  const [players, setPlayers] = useState<PlayerRow[] | null>(null)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState<Pos | 'ALL'>(positionFilter ?? 'ALL')
  const [prevOpen, setPrevOpen] = useState(false)

  // ajustement de state pendant le rendu (pattern React) : reset à chaque ouverture
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setPos(positionFilter ?? 'ALL')
      setQ('')
    }
  }

  const loading = open && players == null

  useEffect(() => {
    if (!open || players != null) return
    let cancelled = false
    fetch('/api/coach/players')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPlayers(d.players ?? []) })
      .catch(() => { if (!cancelled) setPlayers([]) })
    return () => { cancelled = true }
  }, [open, players])

  const filtered = useMemo(() => {
    const all = players ?? []
    const query = q.trim().toLowerCase()
    return all
      .filter((p) => !excludeIds.includes(p.id))
      .filter((p) => pos === 'ALL' || p.position === pos)
      .filter((p) => !query || p.name.toLowerCase().includes(query) || p.club.toLowerCase().includes(query))
      .sort((a, b) => (b.epNext ?? b.form ?? 0) - (a.epNext ?? a.form ?? 0))
      .slice(0, 60)
  }, [players, q, pos, excludeIds])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un joueur ou un club…"
            className="pl-8"
            autoFocus
          />
        </div>
        <div className="flex gap-1">
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPos(p)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                pos === p ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p === 'ALL' ? 'Tous' : p}
            </button>
          ))}
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {loading ? (
            <div className="flex justify-center py-10 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Aucun joueur trouvé</p>
          ) : (
            <div className="space-y-1 pb-2">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPick(p)}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-transparent p-2 text-left transition hover:border-slate-200 hover:bg-slate-50"
                >
                  <PosBadge pos={p.position} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{p.name}</span>
                    <span className="block truncate text-xs text-slate-500">{p.club}</span>
                  </span>
                  <StatusBadge status={p.status} />
                  <span className="w-16 text-right text-xs text-slate-500">
                    {p.epNext != null ? `proj. ${p.epNext.toFixed(1).replace('.', ',')}` : ''}
                  </span>
                  <span className="w-20 text-right text-sm">
                    <Price value={p.price} priceRef={p.priceRef} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
