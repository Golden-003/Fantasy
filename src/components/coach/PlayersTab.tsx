'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PlayerRow } from '@/lib/coach/types'
import { PositionBadge, StatusDot, TrendArrow, VerdictBadge, fmt } from './ui-helpers'

type SortKey = 'projection' | 'form' | 'rating' | 'price' | 'fixtureScore' | 'ownership' | 'name'

export function PlayersTab({ players, onSelect }: { players: PlayerRow[]; onSelect: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [pos, setPos] = useState('ALL')
  const [team, setTeam] = useState('ALL')
  const [sort, setSort] = useState<SortKey>('projection')

  const teams = useMemo(() => [...new Set(players.map((p) => p.teamShort))].sort(), [players])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = players.filter((p) => {
      if (pos !== 'ALL' && p.position !== pos) return false
      if (team !== 'ALL' && p.teamShort !== team) return false
      if (needle && !p.name.toLowerCase().includes(needle) && !p.teamName.toLowerCase().includes(needle)) return false
      return true
    })
    out.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      return (b[sort] as number) - (a[sort] as number)
    })
    return out
  }, [players, q, pos, team, sort])

  const headerBtn = (key: SortKey, label: string, extraCls = '') => (
    <button
      onClick={() => setSort(key)}
      className={`text-[11px] font-semibold uppercase tracking-wide transition hover:text-emerald-300 ${sort === key ? 'text-emerald-400' : 'text-slate-400'} ${extraCls}`}
    >
      {label} {sort === key ? '▾' : ''}
    </button>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Rechercher un joueur…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-full max-w-xs border-slate-800 bg-slate-900/80 text-sm" />
        <Select value={pos} onValueChange={setPos}>
          <SelectTrigger className="h-9 w-[130px] border-slate-800 bg-slate-900/80 text-sm"><SelectValue placeholder="Poste" /></SelectTrigger>
          <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
            <SelectItem value="ALL">Tous postes</SelectItem>
            <SelectItem value="GK">Gardiens</SelectItem>
            <SelectItem value="DEF">Défenseurs</SelectItem>
            <SelectItem value="MID">Milieux</SelectItem>
            <SelectItem value="FWD">Attaquants</SelectItem>
          </SelectContent>
        </Select>
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger className="h-9 w-[150px] border-slate-800 bg-slate-900/80 text-sm"><SelectValue placeholder="Équipe" /></SelectTrigger>
          <SelectContent className="max-h-72 border-slate-800 bg-slate-950 text-slate-200">
            <SelectItem value="ALL">Toutes équipes</SelectItem>
            {teams.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-slate-500">{filtered.length} joueurs</span>
      </div>

      <div className="max-h-[64vh] overflow-y-auto rounded-xl border border-slate-800">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-900">
            <TableRow className="border-slate-800 hover:bg-slate-900">
              <TableHead>{headerBtn('name', 'Joueur')}</TableHead>
              <TableHead className="hidden sm:table-cell">{headerBtn('price', 'Prix')}</TableHead>
              <TableHead>{headerBtn('rating', 'Note')}</TableHead>
              <TableHead>{headerBtn('form', 'Forme')}</TableHead>
              <TableHead className="hidden md:table-cell">{headerBtn('fixtureScore', 'Calendrier')}</TableHead>
              <TableHead>{headerBtn('projection', 'Proj. J')}</TableHead>
              <TableHead className="hidden sm:table-cell">{headerBtn('ownership', 'Poss.')}</TableHead>
              <TableHead>Verdict</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} onClick={() => onSelect(p.id)} className="cursor-pointer border-slate-800/70 hover:bg-slate-900/70">
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={p.status} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-slate-100">{p.name}</span>
                        {p.ownedByMe && <span className="rounded bg-emerald-500/15 px-1 text-[9px] font-bold text-emerald-300" title="Dans ton équipe">MOI</span>}
                        {p.ownedByRivals.length > 0 && <span className="rounded bg-orange-500/15 px-1 text-[9px] font-bold text-orange-300" title={`Possédé par ${p.ownedByRivals.join(', ')}`}>×{p.ownedByRivals.length}</span>}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <PositionBadge pos={p.position} /> {p.teamShort} <TrendArrow trend={p.trend} />
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-slate-300 sm:table-cell">{fmt(p.price)}M</TableCell>
                <TableCell className="text-sm text-slate-200">{fmt(p.rating)}</TableCell>
                <TableCell className={`text-sm font-semibold ${p.form >= 7 ? 'text-emerald-400' : p.form < 6.4 ? 'text-amber-400' : 'text-slate-300'}`}>{fmt(p.form)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className={`text-sm ${p.fixtureScore >= 55 ? 'text-emerald-400' : p.fixtureScore <= 42 ? 'text-red-400' : 'text-slate-300'}`}>{Math.round(p.fixtureScore)}</span>
                </TableCell>
                <TableCell className={`text-sm font-bold ${p.projection >= 7 ? 'text-emerald-400' : p.projection >= 6 ? 'text-amber-300' : p.projection > 0 ? 'text-orange-300' : 'text-red-400'}`}>
                  {p.status === 'INJURED' || p.status === 'SUSPENDED' ? '0,0' : fmt(p.projection)}
                </TableCell>
                <TableCell className="hidden text-xs text-slate-400 sm:table-cell">{fmt(p.ownership)}%</TableCell>
                <TableCell><VerdictBadge verdict={p.verdict} compact /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
