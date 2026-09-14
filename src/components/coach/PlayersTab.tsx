'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import PlayerDetailDialog from '@/components/coach/PlayerDetailDialog'
import { Own, PosBadge, Price, StatusBadge, fr } from '@/components/coach/ui-helpers'
import type { PlayerRow, Pos } from '@/lib/coach/types'
import { Search } from 'lucide-react'

type SortKey = 'epNext' | 'form' | 'totalPoints' | 'priceRef' | 'minutes'
type StatusFilter = 'ALL' | 'DISPO' | 'DOUTEUX' | 'ABSENT'

const PAGE = 50

export default function PlayersTab() {
  const [players, setPlayers] = useState<PlayerRow[] | null>(null)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState<Pos | 'ALL'>('ALL')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [sort, setSort] = useState<SortKey>('epNext')
  const [limit, setLimit] = useState(PAGE)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coach/players')
      .then((r) => r.json())
      .then((d) => setPlayers(d.players ?? []))
      .catch(() => setPlayers([]))
  }, [])

  const clubs = useMemo(() => {
    if (!players) return []
    return [...new Set(players.map((p) => p.club))].sort()
  }, [players])
  const [club, setClub] = useState<string>('ALL')

  const filtered = useMemo(() => {
    if (!players) return []
    const query = q.trim().toLowerCase()
    const list = players
      .filter((p) => pos === 'ALL' || p.position === pos)
      .filter((p) => status === 'ALL' || p.status === status)
      .filter((p) => club === 'ALL' || p.club === club)
      .filter((p) => !query || p.name.toLowerCase().includes(query) || p.club.toLowerCase().includes(query))
    const key = (p: PlayerRow) => (p[sort] ?? (sort === 'priceRef' ? 999 : -1)) as number
    return [...list].sort((a, b) => key(b) - key(a))
  }, [players, q, pos, status, club, sort])

  if (!players) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Rechercher parmi ${players.length} joueurs…`}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['ALL', 'G', 'D', 'M', 'A'] as const).map((p) => (
          <button
            key={p}
            onClick={() => { setPos(p); setLimit(PAGE) }}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              pos === p ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p === 'ALL' ? 'Tous postes' : p}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        {(['ALL', 'DISPO', 'DOUTEUX', 'ABSENT'] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setLimit(PAGE) }}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              status === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s === 'ALL' ? 'Tous statuts' : s === 'DISPO' ? 'Dispo' : s === 'DOUTEUX' ? 'Incertain' : 'Absent'}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <select
          value={club}
          onChange={(e) => { setClub(e.target.value); setLimit(PAGE) }}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 focus:outline-none"
          aria-label="Filtrer par club"
        >
          <option value="ALL">Tous clubs</option>
          {clubs.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 focus:outline-none"
          aria-label="Trier par"
        >
          <option value="epNext">Trier : projection</option>
          <option value="form">Trier : forme</option>
          <option value="totalPoints">Trier : points</option>
          <option value="minutes">Trier : minutes</option>
          <option value="priceRef">Trier : prix</option>
        </select>
      </div>

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">Aucun joueur ne correspond.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.slice(0, limit).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDetailId(p.id)}
                  className="flex w-full items-center gap-2.5 p-3 text-left transition hover:bg-slate-50"
                  data-testid={`market-${p.name}`}
                >
                  <PosBadge pos={p.position} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {p.name}
                      {p.status !== 'DISPO' && <span className="ml-2 inline-block"><StatusBadge status={p.status} /></span>}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {p.club} · {p.minutes ?? 0} min · {p.goals ?? 0} b / {p.assists ?? 0} pd
                    </span>
                  </span>
                  <span className="hidden w-12 text-right text-xs tabular-nums text-slate-500 sm:block">{fr(p.form)}</span>
                  <span className="w-10 text-right text-sm font-bold tabular-nums text-slate-900">{p.totalPoints ?? '—'}</span>
                  <span className="hidden w-14 text-right text-xs tabular-nums text-slate-500 sm:block">proj. {fr(p.epNext)}</span>
                  <span className="hidden w-16 text-right sm:block"><Own value={p.ownership} valueRef={p.ownershipRef} /></span>
                  <span className="w-20 text-right text-sm"><Price value={p.price} priceRef={p.priceRef} /></span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.length > limit && (
        <button
          onClick={() => setLimit((l) => l + PAGE)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Afficher plus ({filtered.length - limit} restants)
        </button>
      )}

      <PlayerDetailDialog playerId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
