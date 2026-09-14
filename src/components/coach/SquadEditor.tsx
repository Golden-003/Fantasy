'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import PlayerPickerDialog from '@/components/coach/PlayerPickerDialog'
import { PosBadge, Price } from '@/components/coach/ui-helpers'
import { RULES } from '@/lib/coach/rules'
import type { PlayerRow, Pos, SquadPlayerView } from '@/lib/coach/types'
import { ArrowDownUp, Check, Loader2, Repeat, X } from 'lucide-react'

interface Slot {
  playerId: string
  name: string
  club: string
  position: Pos
  role: 'TITULAIRE' | 'BANC'
  captain: boolean
  price: number | null
  priceRef: number | null
}

export default function SquadEditor({
  managerId,
  initialSquad,
  showCaptain = false,
  onSaved,
  onClose,
}: {
  managerId: string
  initialSquad: SquadPlayerView[]
  showCaptain?: boolean
  onSaved?: () => void
  onClose?: () => void
}) {
  const [slots, setSlots] = useState<Slot[]>(
    initialSquad.map((p) => ({
      playerId: p.id, name: p.name, club: p.club, position: p.position,
      role: p.role, captain: p.captain, price: p.price, priceRef: p.priceRef,
    })),
  )
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [swapFrom, setSwapFrom] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c = { G: 0, D: 0, M: 0, A: 0 }
    for (const s of slots) c[s.position]++
    return c
  }, [slots])
  const starters = slots.filter((s) => s.role === 'TITULAIRE')
  const quotaOk =
    counts.G === RULES.quota.G && counts.D === RULES.quota.D && counts.M === RULES.quota.M && counts.A === RULES.quota.A
  const captainOk = !showCaptain || slots.filter((s) => s.captain && s.role === 'TITULAIRE').length === 1

  const replacePlayer = (oldPlayerId: string, player: PlayerRow) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.playerId === oldPlayerId
          ? { ...s, playerId: player.id, name: player.name, club: player.club, position: player.position, price: player.price, priceRef: player.priceRef }
          : s,
      ),
    )
    setPickerFor(null)
    setError(null)
  }

  const toggleSwap = (playerId: string) => {
    if (!swapFrom) {
      setSwapFrom(playerId)
      return
    }
    if (swapFrom === playerId) {
      setSwapFrom(null)
      return
    }
    setSlots((prev) => {
      const a = prev.find((s) => s.playerId === swapFrom)
      const b = prev.find((s) => s.playerId === playerId)
      if (!a || !b) return prev
      return prev.map((s) => {
        if (s.playerId === swapFrom) return { ...s, role: b.role }
        if (s.playerId === playerId) return { ...s, role: a.role }
        return s
      })
    })
    setSwapFrom(null)
    setError(null)
  }

  const toggleCaptain = (playerId: string) => {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.playerId === playerId && s.role === 'TITULAIRE') return { ...s, captain: !s.captain }
        if (s.captain) return { ...s, captain: false }
        return s
      }),
    )
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/coach/squad', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId,
          slots: slots.map((s) => ({ playerId: s.playerId, role: s.role, captain: s.captain })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const quotaText = `G ${counts.G}/${RULES.quota.G} · D ${counts.D}/${RULES.quota.D} · M ${counts.M}/${RULES.quota.M} · A ${counts.A}/${RULES.quota.A}`

  const row = (s: Slot) => {
    const isSwapSource = swapFrom === s.playerId
    return (
      <div
        key={s.playerId}
        className={`flex items-center gap-2 rounded-lg border p-2 transition ${
          isSwapSource ? 'border-red-400 bg-red-50' : s.role === 'TITULAIRE' ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <PosBadge pos={s.position} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900">
            {s.name}
            {s.captain && (
              <span className="rounded bg-slate-900 px-1 text-[9px] font-bold text-white">C</span>
            )}
          </p>
          <p className="truncate text-[11px] text-slate-500">{s.club}</p>
        </div>
        <span className="text-xs">
          <Price value={s.price} priceRef={s.priceRef} />
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setPickerFor(s.playerId)}
            title="Remplacer"
            aria-label={`Remplacer ${s.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Repeat className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => toggleSwap(s.playerId)}
            title={isSwapSource ? 'Annuler l’échange' : 'Basculer titulaire/banc'}
            aria-label={`Basculer ${s.name}`}
            className={`flex h-7 w-7 items-center justify-center rounded-md border transition ${
              isSwapSource ? 'border-red-400 bg-red-500 text-white' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            {isSwapSource ? <X className="h-3.5 w-3.5" /> : <ArrowDownUp className="h-3.5 w-3.5" />}
          </button>
          {showCaptain && s.role === 'TITULAIRE' && (
            <button
              onClick={() => toggleCaptain(s.playerId)}
              aria-pressed={s.captain}
              title="Capitaine"
              aria-label={`Capitaine ${s.name}`}
              className={`flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-black transition ${
                s.captain ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-700'
              }`}
            >
              C
            </button>
          )}
        </div>
      </div>
    )
  }

  const pickerExclude = slots.map((s) => s.playerId)
  const pickerPos = pickerFor ? slots.find((s) => s.playerId === pickerFor)?.position : undefined

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-md border px-2 py-1 font-semibold tabular-nums ${quotaOk ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          {quotaText}
        </span>
        <span className={`rounded-md border px-2 py-1 font-semibold ${starters.length === 11 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          {starters.length}/11 titulaires
        </span>
        <span className="ml-auto text-slate-400">
          {swapFrom ? 'Choisis le joueur avec qui échanger' : 'Remplacer = choisir un joueur · ⇅ = titulaire/banc'}
        </span>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Titulaires</p>
        <div className="grid gap-1.5 sm:grid-cols-2">{slots.filter((s) => s.role === 'TITULAIRE').map(row)}</div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Banc</p>
        <div className="grid gap-1.5 sm:grid-cols-2">{slots.filter((s) => s.role === 'BANC').map(row)}</div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-700">{error}</p>
      )}

      <div className="flex items-center justify-end gap-2">
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
        )}
        <Button size="sm" onClick={save} disabled={saving || !quotaOk || starters.length !== 11 || !captainOk} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Enregistrer l’effectif
        </Button>
      </div>

      <PlayerPickerDialog
        open={pickerFor != null}
        onClose={() => setPickerFor(null)}
        onPick={(player) => pickerFor && replacePlayer(pickerFor, player)}
        positionFilter={pickerPos}
        excludeIds={pickerExclude}
        title={`Remplacer — poste ${pickerPos ?? ''}`}
      />
    </div>
  )
}
