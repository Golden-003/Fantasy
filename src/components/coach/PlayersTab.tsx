'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { MarketTarget, Pos } from '@/lib/coach/types'
import { ConfirmBadge, Own, PlayerAvatar, PosBadge, POS_LABEL, Price, SourceChip } from './ui-helpers'
import { Search, Target } from 'lucide-react'

interface PlayerRow {
  id: string
  name: string
  club: string
  clubConfirmed: boolean
  position: Pos
  price: number | null
  ownership: number | null
  priceSource: string | null
  formNote: string | null
}

const FILTERS: Array<{ key: 'ALL' | Pos; label: string }> = [
  { key: 'ALL', label: 'Tous' },
  { key: 'G', label: 'Gardiens' },
  { key: 'D', label: 'Défenseurs' },
  { key: 'M', label: 'Milieux' },
  { key: 'A', label: 'Attaquants' },
]

export default function PlayersTab() {
  const [players, setPlayers] = useState<PlayerRow[] | null>(null)
  const [targets, setTargets] = useState<MarketTarget[]>([])
  const [filter, setFilter] = useState<'ALL' | Pos>('ALL')
  const [q, setQ] = useState('')

  useEffect(() => {
    fetch('/api/coach/players')
      .then((r) => r.json())
      .then((d) => {
        setPlayers(d.players ?? [])
        setTargets(d.targets ?? [])
      })
      .catch(console.error)
  }, [])

  const shown = useMemo(() => {
    return (players ?? []).filter(
      (p) =>
        (filter === 'ALL' || p.position === filter) &&
        (q.trim() === '' || `${p.name} ${p.club}`.toLowerCase().includes(q.toLowerCase()))
    )
  }, [players, filter, q])

  if (!players) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-violet-300" /> Cibles marché sourcées — avant la clôture R5
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {targets.slice(0, 6).map((t) => (
            <div key={t.playerId} className="flex items-center gap-3 rounded-lg border border-border bg-zinc-900/40 p-2.5">
              <PlayerAvatar name={t.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {t.name} <span className="text-xs font-normal text-zinc-500">{t.club} · <Price value={t.price} /></span>
                </p>
                <p className="truncate text-[11px] text-zinc-400">{t.rationale}{t.formNote ? ` · ${t.formNote}` : ''}</p>
              </div>
              <div className="text-right text-[11px] text-zinc-500">
                <Own value={t.ownership} />
              </div>
            </div>
          ))}
          <p className="text-[11px] text-zinc-500 sm:col-span-2">
            Prix et % issus de l’article officiel Sofascore du 11 sept 2026. Vérifie ton budget réel dans l’app (9 de tes 15 prix sont encore à confirmer) — 2 transferts gratuits disponibles.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Base joueurs réelle — {players.length} joueurs tracés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un joueur ou un club…" className="pl-8" />
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${filter === f.key ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
            {shown.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-zinc-900/30 p-2.5">
                <PlayerAvatar name={p.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {p.name} <PosBadge pos={p.position} />
                    {!p.clubConfirmed && <ConfirmBadge label="club ?" />}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {p.club} · <POS_LABEL_POS pos={p.position} />{p.formNote ? ` · ${p.formNote}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <Price value={p.price} />
                  <Own value={p.ownership} />
                </div>
              </div>
            ))}
            {shown.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">Aucun joueur ne correspond.</p>}
          </div>
          <div className="mt-3">
            <SourceChip source="Article officiel Sofascore « Picks R4 » (11 sept 2026) + captures Vital_GDB" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function POS_LABEL_POS({ pos }: { pos: Pos }) {
  return <>{POS_LABEL[pos]}</>
}
