'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import PlayerDetailDialog from '@/components/coach/PlayerDetailDialog'
import SquadEditor from '@/components/coach/SquadEditor'
import { PosBadge } from '@/components/coach/ui-helpers'
import type { LeagueView, ManagerDetail } from '@/lib/coach/types'
import { ArrowRightLeft, ChevronDown, Loader2, Pencil, Plus, Trophy, Users } from 'lucide-react'

export default function LeagueTab() {
  const [league, setLeague] = useState<LeagueView | null>(null)
  const [details, setDetails] = useState<Record<string, ManagerDetail>>({})
  const [openManager, setOpenManager] = useState<string | null>(null)
  const [editManager, setEditManager] = useState<ManagerDetail | null>(null)
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null)
  const [scoreEdit, setScoreEdit] = useState<{ manager: ManagerDetail; round: string; points: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [addTransferFor, setAddTransferFor] = useState<ManagerDetail | null>(null)
  const [transferRound, setTransferRound] = useState('5')
  const [transferNote, setTransferNote] = useState('')
  const [transferMsg, setTransferMsg] = useState<string | null>(null)

  const loadLeague = useCallback(async () => {
    const d = await fetch('/api/coach/league').then((r) => r.json())
    setLeague(d.error ? null : d)
  }, [])

  const loadManager = useCallback(async (slug: string): Promise<ManagerDetail | null> => {
    const d = await fetch(`/api/coach/manager?slug=${slug}`).then((r) => r.json())
    if (d.error) return null
    setDetails((prev) => ({ ...prev, [slug]: d }))
    return d
  }, [])

  useEffect(() => {
    loadLeague().catch(console.error)
  }, [loadLeague])

  useEffect(() => {
    if (openManager && !details[openManager]) loadManager(openManager).catch(console.error)
  }, [openManager, details, loadManager])

  const saveScore = async () => {
    if (!scoreEdit) return
    setSaving(true)
    try {
      const m = scoreEdit.manager
      await fetch('/api/coach/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId: m.id,
          managerSlug: m.slug,
          round: Number(scoreEdit.round),
          points: scoreEdit.points === '' ? null : Number(scoreEdit.points),
        }),
      })
      setScoreEdit(null)
      await Promise.all([loadLeague(), loadManager(m.slug)])
    } finally {
      setSaving(false)
    }
  }

  const addRivalTransfer = async () => {
    if (!addTransferFor) return
    setSaving(true)
    setTransferMsg(null)
    try {
      const res = await fetch('/api/coach/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId: addTransferFor.id,
          managerSlug: addTransferFor.slug,
          round: Number(transferRound) || 5,
          note: transferNote || null,
          applyToSquad: false,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Erreur')
      setAddTransferFor(null)
      setTransferNote('')
      await loadManager(addTransferFor.slug)
    } catch (e) {
      setTransferMsg(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (!league) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-slate-400" /> {league.name} · {league.season}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {league.standings.map((row) => (
            <div
              key={row.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${row.isUser ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                  row.rank === 1 ? 'bg-amber-100 text-amber-700' : row.isUser ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {row.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {row.name}
                  {row.isUser && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">TOI</span>}
                </p>
                <p className="text-[11px] text-slate-500">
                  {row.roundsKnown > 0 ? `${row.roundsKnown} journée(s) enregistrée(s)` : 'aucun score enregistré'}
                  {row.lastPoints != null && ` · dernière : ${row.lastPoints} pts`}
                </p>
              </div>
              <span className="text-lg font-black tabular-nums text-slate-900">{row.total ?? '—'}</span>
            </div>
          ))}
          <p className="pt-1 text-[11px] text-slate-400">
            Les scores se saisissent manuellement dans la fiche de chaque manager — pas besoin de capture.
          </p>
        </CardContent>
      </Card>

      {/* Fiches managers */}
      <div className="space-y-2">
        {league.standings.map((row) => {
          const open = openManager === row.slug
          const d = details[row.slug]
          return (
            <Card key={row.id}>
              <button
                onClick={() => setOpenManager(open ? null : row.slug)}
                className="flex w-full items-center gap-3 p-4 text-left"
                aria-expanded={open}
              >
                <Users className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{row.name}</span>
                {d && <span className="text-xs text-slate-400">{d.squad.length}/15 joueurs</span>}
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && d && (
                <CardContent className="border-t border-slate-100 pt-3">
                  <div className="space-y-3">
                    {/* scores par journée */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.scores.length === 0 && <p className="text-xs text-slate-400">Aucun score saisi.</p>}
                      {d.scores.map((s) => (
                        <button
                          key={s.round}
                          onClick={() => setScoreEdit({ manager: d, round: String(s.round), points: s.points != null ? String(s.points) : '' })}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
                          title="Modifier ce score"
                        >
                          <span className="font-bold text-slate-400">J{s.round}</span> {s.points ?? '—'}
                        </button>
                      ))}
                      <button
                        onClick={() => setScoreEdit({ manager: d, round: String(league.currentRound), points: '' })}
                        className="flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                      >
                        <Plus className="h-3 w-3" /> score
                      </button>
                    </div>

                    {/* effectif */}
                    {d.squad.length > 0 ? (
                      <div className="grid gap-1 sm:grid-cols-2">
                        {d.squad.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setDetailPlayerId(p.id)}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-left transition hover:bg-slate-50"
                          >
                            <PosBadge pos={p.position} />
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{p.name}</span>
                            <span className="truncate text-[10px] text-slate-400">{p.club}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Effectif non enregistré — ajoute-le avec « Modifier l’effectif ».</p>
                    )}

                    {/* actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setEditManager(d)}
                        className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                      >
                        <Pencil className="h-3 w-3" /> Modifier l’effectif
                      </button>
                      <button
                        onClick={() => setAddTransferFor(d)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <ArrowRightLeft className="h-3 w-3" /> Ajouter un transfert
                      </button>
                    </div>

                    {/* transferts */}
                    {d.transfers.length > 0 && (
                      <div className="space-y-1">
                        {d.transfers.map((t) => (
                          <div key={t.id} className="rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                            <span className="font-bold text-slate-400">J{t.round}</span>{' '}
                            {t.inName && (
                              <>
                                <b>{t.inName}</b> arrive
                                {t.outName && (
                                  <>
                                    {' '}
                                    <span className="text-slate-400">·</span> <b>{t.outName}</b> part
                                  </>
                                )}
                              </>
                            )}
                            {!t.inName && t.outName && (
                              <>
                                <b>{t.outName}</b> part
                              </>
                            )}
                            {t.note && <span className="text-slate-400"> — {t.note}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Dialog édition effectif rival */}
      <Dialog open={editManager != null} onOpenChange={(o) => !o && setEditManager(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Effectif — {editManager?.name}</DialogTitle>
          </DialogHeader>
          {editManager && (
            <SquadEditor
              managerId={editManager.id}
              initialSquad={editManager.squad}
              onSaved={() => loadManager(editManager.slug)}
              onClose={() => setEditManager(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog score */}
      <Dialog open={scoreEdit != null} onOpenChange={(o) => !o && setScoreEdit(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">Score — {scoreEdit?.manager.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Journée</span>
              <Input
                value={scoreEdit?.round ?? ''}
                onChange={(e) => scoreEdit && setScoreEdit({ ...scoreEdit, round: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                className="w-20"
                aria-label="Journée"
              />
            </div>
            <Input
              value={scoreEdit?.points ?? ''}
              onChange={(e) => scoreEdit && setScoreEdit({ ...scoreEdit, points: e.target.value.replace(/[^0-9-]/g, '').slice(0, 3) })}
              placeholder="Points de la journée"
              inputMode="numeric"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setScoreEdit(null)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
                Annuler
              </button>
              <button
                onClick={saveScore}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog transfert rival (note libre) */}
      <Dialog open={addTransferFor != null} onOpenChange={(o) => !o && setAddTransferFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Transfert — {addTransferFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Journée</span>
              <Input
                value={transferRound}
                onChange={(e) => setTransferRound(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                className="w-20"
                aria-label="Journée"
              />
            </div>
            <Input
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="Ex : Haaland arrive, Isak part"
              autoFocus
            />
            {transferMsg && <p className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-700">{transferMsg}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setAddTransferFor(null)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
                Annuler
              </button>
              <button
                onClick={addRivalTransfer}
                disabled={saving || !transferNote.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Enregistrer
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Pour un transfert précis joueur à joueur, passe d’abord par « Modifier l’effectif » (Remplacer), le transfert se note ici.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <PlayerDetailDialog playerId={detailPlayerId} onClose={() => setDetailPlayerId(null)} />
    </div>
  )
}
