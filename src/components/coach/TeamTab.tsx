'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import PlayerDetailDialog from '@/components/coach/PlayerDetailDialog'
import PlayerPickerDialog from '@/components/coach/PlayerPickerDialog'
import SquadEditor from '@/components/coach/SquadEditor'
import { DiffBadge, PlayerAvatar, PosBadge, StatusBadge, fr } from '@/components/coach/ui-helpers'
import type { CaptainPick, SquadPlayerView, TeamView, TransferFlag, TransferItem } from '@/lib/coach/types'
import { ArrowRightLeft, CheckCircle2, Crown, Eye, Loader2, Pencil, ShieldAlert, Trash2 } from 'lucide-react'

const ROW_LABEL: Record<string, string> = { G: 'Gardien', D: 'Défenseurs', M: 'Milieux', A: 'Attaquants' }

export default function TeamTab() {
  const [data, setData] = useState<{ team: TeamView; captains: CaptainPick[]; flags: TransferFlag[] } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transfers, setTransfers] = useState<TransferItem[]>([])
  const [savingTransfer, setSavingTransfer] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  // formulaire transfert
  const [outPlayer, setOutPlayer] = useState<SquadPlayerView | null>(null)
  const [inPick, setInPick] = useState<{ id: string; name: string; club: string; position: string } | null>(null)
  const [pickerMode, setPickerMode] = useState<'OUT' | 'IN' | null>(null)
  const [transferRound, setTransferRound] = useState('5')
  const [transferNote, setTransferNote] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/coach/team')
    const d = await res.json()
    if (!d.error) setData(d)
    const t = await fetch('/api/coach/transfers?manager=vital_gdb').then((r) => r.json())
    setTransfers(t.transfers ?? [])
  }, [])

  useEffect(() => {
    load().catch(console.error)
  }, [load])

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const { team, captains, flags } = data
  const byRow = (pos: string) => team.starters.filter((p) => p.position === pos)

  const chip = (p: SquadPlayerView) => (
    <button
      key={p.id}
      onClick={() => setDetailId(p.id)}
      className="flex w-24 flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition hover:border-slate-300 hover:shadow sm:w-28"
      data-testid={`team-player-${p.name}`}
    >
      <PlayerAvatar name={p.name} size="sm" />
      <span className="flex w-full items-center justify-center gap-1">
        {p.captain && <span className="rounded bg-slate-900 px-1 text-[9px] font-black text-white">C</span>}
        <span className="truncate text-xs font-bold text-slate-900">{p.name}</span>
      </span>
      <span className="truncate text-[10px] text-slate-500">{p.club}</span>
      {p.status !== 'DISPO' && <StatusBadge status={p.status} />}
    </button>
  )

  const submitTransfer = async () => {
    if (!outPlayer || !inPick) return
    setSavingTransfer(true)
    setTransferError(null)
    try {
      const res = await fetch('/api/coach/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId: team.managerId,
          managerSlug: 'vital_gdb',
          round: Number(transferRound) || 5,
          outPlayerId: outPlayer.id,
          inPlayerId: inPick.id,
          note: transferNote || null,
          applyToSquad: true,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Erreur')
      setTransferOpen(false)
      setOutPlayer(null)
      setInPick(null)
      setTransferNote('')
      await load()
    } catch (e) {
      setTransferError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSavingTransfer(false)
    }
  }

  const deleteTransfer = async (id: string) => {
    await fetch(`/api/coach/transfers?id=${id}`, { method: 'DELETE' })
    setTransfers((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold text-slate-900">
          Vital_GDB <span className="text-sm font-normal text-slate-500">· {team.formation}</span>
        </h2>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setTransferOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" /> Transfert
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            <Pencil className="h-3.5 w-3.5" /> Modifier l’effectif
          </button>
        </div>
      </div>

      {/* Terrain */}
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50 to-emerald-100/60 p-4">
        {(['G', 'D', 'M', 'A'] as const).map((pos) => (
          <div key={pos} className="mb-3 last:mb-0">
            <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-emerald-700/60">{ROW_LABEL[pos]}</p>
            <div className="flex flex-wrap items-start justify-center gap-2">
              {byRow(pos).map(chip)}
            </div>
          </div>
        ))}
        <div className="mt-4 border-t border-emerald-200/70 pt-3">
          <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Banc</p>
          <div className="flex flex-wrap items-start justify-center gap-2">
            {team.bench.map((p) => (
              <button
                key={p.id}
                onClick={() => setDetailId(p.id)}
                className="flex w-24 flex-col items-center gap-1 rounded-xl border border-slate-200/80 bg-white/80 p-2 opacity-90 transition hover:opacity-100 sm:w-28"
              >
                <PlayerAvatar name={p.name} size="sm" />
                <span className="truncate text-xs font-bold text-slate-900">{p.name}</span>
                <span className="truncate text-[10px] text-slate-500">{p.club}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Capitaines suggérés + vigilance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Crown className="h-4 w-4 text-slate-400" /> Capitaine — classement J{team.starters[0]?.round ?? 5}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {captains.slice(0, 3).map((c) => (
              <div key={c.playerId} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${c.rank === 1 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {c.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {c.name} <span className="text-xs font-normal text-slate-500">{c.club}</span>
                  </p>
                  <p className="truncate text-[11px] text-slate-500">{c.reasons.join(' · ')}</p>
                </div>
                <span className="shrink-0 text-sm font-black tabular-nums text-slate-900">{c.score.toString().replace('.', ',')}</span>
              </div>
            ))}
            {captains.length === 0 && <p className="text-sm text-slate-400">Aucun titulaire éligible.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4 text-slate-400" /> Signaux effectif
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {flags.length === 0 && <p className="text-sm text-slate-400">Aucun signal particulier.</p>}
            {flags.map((f) => (
              <div key={f.playerId} className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-2.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    f.kind === 'DOUTE' ? 'bg-rose-50 text-rose-700' : f.kind === 'SURVEILLER' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {f.kind}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{f.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{f.reason}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Historique des transferts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ArrowRightLeft className="h-4 w-4 text-slate-400" /> Mes transferts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {transfers.length === 0 && <p className="text-sm text-slate-400">Aucun transfert enregistré.</p>}
          {transfers.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-sm">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">J{t.round}</span>
              <span className="min-w-0 flex-1 truncate text-slate-700">
                <b>{t.inName ?? '—'}</b>
                <span className="text-slate-400"> à la place de </span>
                {t.outName ?? '—'}
              </span>
              <button onClick={() => deleteTransfer(t.id)} aria-label="Supprimer" className="text-slate-300 transition hover:text-rose-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Dialog édition effectif */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Modifier l’effectif</DialogTitle>
          </DialogHeader>
          <SquadEditor
            managerId={team.managerId}
            initialSquad={[...team.starters, ...team.bench]}
            showCaptain
            onSaved={load}
            onClose={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog transfert */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Enregistrer un transfert</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPickerMode('OUT')}
                className="rounded-lg border border-dashed border-slate-300 p-3 text-left transition hover:border-slate-400"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Vendu</p>
                <p className="truncate text-sm font-semibold text-slate-900">{outPlayer?.name ?? 'Choisir…'}</p>
                <p className="truncate text-[11px] text-slate-500">{outPlayer?.club ?? ''}</p>
              </button>
              <button
                onClick={() => setPickerMode('IN')}
                className="rounded-lg border border-dashed border-slate-300 p-3 text-left transition hover:border-slate-400"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Acheté</p>
                <p className="truncate text-sm font-semibold text-slate-900">{inPick?.name ?? 'Choisir…'}</p>
                <p className="truncate text-[11px] text-slate-500">{inPick?.club ?? ''}</p>
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                value={transferRound}
                onChange={(e) => setTransferRound(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                placeholder="Journée"
                className="w-24"
                aria-label="Journée du transfert"
              />
              <Input value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Note (optionnel)" />
            </div>
            {transferError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-700">{transferError}</p>}
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setTransferOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
                Annuler
              </button>
              <button
                onClick={submitTransfer}
                disabled={!outPlayer || !inPick || savingTransfer}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
              >
                {savingTransfer ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Enregistrer
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              L’effectif est mis à jour automatiquement : à poste identique, le joueur prend la place du sortant.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Picker OUT = joueurs de l'effectif */}
      <PlayerPickerDialog
        open={pickerMode === 'OUT'}
        onClose={() => setPickerMode(null)}
        onPick={(p) => {
          const full = [...team.starters, ...team.bench].find((s) => s.id === p.id)
          setOutPlayer(full ?? null)
          setPickerMode(null)
        }}
        excludeIds={inPick ? [inPick.id] : []}
        title="Vendre — joueur de l’effectif"
      />
      {/* Picker IN = tout le marché */}
      <PlayerPickerDialog
        open={pickerMode === 'IN'}
        onClose={() => setPickerMode(null)}
        onPick={(p) => {
          setInPick({ id: p.id, name: p.name, club: p.club, position: p.position })
          setPickerMode(null)
        }}
        excludeIds={outPlayer ? [outPlayer.id] : []}
        title="Acheter — tout le marché"
      />

      <PlayerDetailDialog playerId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
