'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { LiveStandingRow, LiveView } from '@/lib/coach/types'
import { Check, CloudUpload, Crown, Info, Loader2, RefreshCw, Target, Zap } from 'lucide-react'

const ROUND_OPTIONS = [
  { round: 5, date: '18 sept.' },
  { round: 6, date: '10 oct.' },
  { round: 7, date: '17 oct.' },
  { round: 8, date: '23 oct.' },
]

const POS_CHIP: Record<string, string> = {
  G: 'bg-amber-100 text-amber-700 border-amber-200',
  D: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  M: 'bg-sky-100 text-sky-700 border-sky-200',
  A: 'bg-rose-100 text-rose-700 border-rose-200',
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved'

export default function LiveTab() {
  const [view, setView] = useState<LiveView | null>(null)
  const [round, setRound] = useState(5)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [captain, setCaptain] = useState<string | null>(null)
  const [tripleCaptain, setTripleCaptain] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Refs synchronisées : persist lit toujours les valeurs fraîches
  // (évite les closures périmées dans les setTimeout d'autosave)
  const draftRef = useRef(draft)
  const viewRef = useRef(view)
  const captainRef = useRef(captain)
  const tcRef = useRef(tripleCaptain)
  const roundRef = useRef(round)
  useEffect(() => { draftRef.current = draft }, [draft])
  useEffect(() => { viewRef.current = view }, [view])
  useEffect(() => { captainRef.current = captain }, [captain])
  useEffect(() => { tcRef.current = tripleCaptain }, [tripleCaptain])
  useEffect(() => { roundRef.current = round }, [round])

  const fetchLive = useCallback(async (r: number): Promise<LiveView> => {
    const res = await fetch(`/api/coach/live?round=${r}`)
    return res.json()
  }, [])

  const applyView = useCallback((data: LiveView) => {
    setView(data)
    setCaptain(data.captainPlayerId)
    setTripleCaptain(data.tripleCaptain)
    const d: Record<string, string> = {}
    for (const row of data.rows) d[row.playerId] = row.points != null ? String(row.points) : ''
    setDraft(d)
    setSaveState('idle')
    setSavedAt(data.live.lastUpdate)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchLive(round)
      .then((data) => { if (!cancelled) applyView(data) })
      .catch(console.error)
    return () => { cancelled = true }
  }, [round, fetchLive, applyView])

  const persist = useCallback(async (r?: number) => {
    const targetRound = r ?? roundRef.current
    const current = draftRef.current
    const rows = viewRef.current?.rows ?? []
    const entries = rows.map((row) => {
      const raw = current[row.playerId] ?? ''
      const parsed = raw === '' ? null : Number.parseInt(raw, 10)
      return { playerId: row.playerId, points: parsed != null && Number.isFinite(parsed) ? parsed : null }
    })
    setSaveState('saving')
    try {
      const res = await fetch('/api/coach/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round: targetRound, entries, captainPlayerId: captainRef.current, tripleCaptain: tcRef.current }),
      })
      const data: LiveView = await res.json()
      // Ne remplace la vue que si on est toujours sur la même journée
      if (roundRef.current === targetRound) setView(data)
      setSavedAt(new Date().toISOString())
      setSaveState('saved')
    } catch {
      setSaveState('dirty')
    }
  }, [])

  const scheduleSave = useCallback((delay = 800) => {
    setSaveState('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { persist().catch(console.error) }, delay)
  }, [persist])

  const setPoints = (playerId: string, value: string) => {
    const clean = value.replace(/[^0-9-]/g, '').slice(0, 3)
    setDraft((d) => ({ ...d, [playerId]: clean }))
    scheduleSave()
  }

  const pickCaptain = (playerId: string) => {
    const next = captainRef.current === playerId ? null : playerId
    captainRef.current = next // sync immédiat : la sauvegarde part avec la bonne valeur
    setCaptain(next)
    scheduleSave(400)
  }

  const toggleToken = () => {
    const next = !tcRef.current
    tcRef.current = next // sync immédiat
    setTripleCaptain(next)
    scheduleSave(400)
  }

  const changeRound = (r: number) => {
    if (r === roundRef.current) return
    if (timer.current) clearTimeout(timer.current)
    if (saveState === 'dirty') persist(roundRef.current).catch(console.error) // flush de l'ancienne journée
    setRound(r)
  }

  const resetRound = async () => {
    if (timer.current) clearTimeout(timer.current)
    await fetch(`/api/coach/live?round=${round}`, { method: 'DELETE' })
    fetchLive(round).then(applyView).catch(console.error)
  }

  // ── Recalcul INSTANTANÉ côté client ───────────────────────────
  const computed = useMemo(() => {
    if (!view) return null
    const parse = (id: string) => {
      const raw = draft[id] ?? ''
      const n = raw === '' ? null : Number.parseInt(raw, 10)
      return n != null && Number.isFinite(n) ? n : null
    }
    const starters = view.rows.filter((r) => r.role === 'TITULAIRE')
    const bench = view.rows.filter((r) => r.role === 'BANC')
    const startersPoints = starters.reduce((acc, r) => acc + (parse(r.playerId) ?? 0), 0)
    const startersEntered = starters.filter((r) => parse(r.playerId) != null).length
    const capRow = starters.find((r) => r.playerId === captain)
    const capPoints = capRow ? parse(capRow.playerId) : null
    const multiplier: 2 | 3 = tripleCaptain ? 3 : 2
    const captainBonus = capPoints != null ? (multiplier - 1) * capPoints : 0
    const benchPoints = bench.reduce((acc, r) => acc + (parse(r.playerId) ?? 0), 0)
    const liveRoundPoints = startersPoints + captainBonus
    const projectedTotal = view.live.baseTotal + liveRoundPoints

    const officialRank = new Map(view.standings.map((s) => [s.name, s.rank]))
    const sim: LiveStandingRow[] = view.standings.map((s) => ({
      ...s,
      liveRoundPoints: s.isUser ? liveRoundPoints : null,
      projectedTotal: s.isUser ? projectedTotal : s.baseTotal,
      rank: 0, moved: false,
    }))
    sim.sort((a, b) => (b.projectedTotal ?? b.baseTotal ?? 0) - (a.projectedTotal ?? a.baseTotal ?? 0))
    sim.forEach((r, i) => { r.rank = i + 1; r.moved = officialRank.get(r.name) !== r.rank })

    return { startersPoints, startersEntered, startersTotal: starters.length, captainBonus, benchPoints, liveRoundPoints, projectedTotal, sim, multiplier }
  }, [view, draft, captain, tripleCaptain])

  if (!view || !computed) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const starters = view.rows.filter((r) => r.role === 'TITULAIRE')
  const bench = view.rows.filter((r) => r.role === 'BANC')
  const lastUp = savedAt ? new Date(savedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null

  const playerRow = (row: (typeof view.rows)[number], isBench: boolean) => {
    const isCap = captain === row.playerId
    return (
      <div key={row.playerId} data-testid={`live-row-${row.name}`} className={`rounded-lg border p-3 ${isBench ? 'border-slate-200 bg-slate-50 opacity-80' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-2">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-black ${POS_CHIP[row.position] ?? ''}`}>{row.position}</span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900">
              {row.name}
              {!isBench && (
                <button
                  onClick={() => pickCaptain(row.playerId)}
                  aria-pressed={isCap}
                  aria-label={`Capitaine ${row.name}`}
                  className={`ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition ${isCap ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-400 hover:text-slate-600'}`}
                >
                  C
                </button>
              )}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {row.club}{row.fixture ? ` · J${view.round} ${row.fixture}` : ''}{row.pointsR4 != null ? ` · J4 : ${row.pointsR4} pts` : ''}
            </p>
          </div>
          <Input
            inputMode="numeric"
            placeholder="pts"
            value={draft[row.playerId] ?? ''}
            onChange={(e) => setPoints(row.playerId, e.target.value)}
            aria-label={`Points live de ${row.name}`}
            className="h-9 w-16 shrink-0 border-slate-200 bg-white text-center text-sm font-bold tabular-nums text-slate-900"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur de journée */}
      <div className="flex flex-wrap items-center gap-2">
        {ROUND_OPTIONS.map((o) => (
          <button
            key={o.round}
            onClick={() => changeRound(o.round)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${round === o.round ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            J{o.round} <span className={`text-[10px] font-normal ${round === o.round ? 'text-slate-300' : 'text-slate-400'}`}>{o.date}</span>
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
          {saveState === 'saving' && <><CloudUpload className="h-3.5 w-3.5 animate-pulse" /> sauvegarde…</>}
          {saveState === 'saved' && lastUp && <><Check className="h-3.5 w-3.5 text-emerald-500" /> sauvegardé à {lastUp}</>}
          {saveState === 'dirty' && <><Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" /> modifications en attente…</>}
          {saveState === 'idle' && lastUp && <>dernière saisie {lastUp}</>}
        </span>
      </div>

      {/* Résumé live */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-red-500" /> Score live J{view.round}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-normal text-slate-500">{computed.startersEntered}/{computed.startersTotal} titulaires saisis</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-2xl font-black tabular-nums text-slate-900" data-testid="live-round-points">{computed.liveRoundPoints}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">pts live journée</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-2xl font-black tabular-nums text-slate-900" data-testid="live-projected">{computed.projectedTotal}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">total projeté</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-2xl font-black tabular-nums text-slate-500">{view.live.baseTotal}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">base (après J4)</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>Titulaires : <b className="text-slate-800">{computed.startersPoints}</b></span>
            <span>·</span>
            <span>
              Bonus capitaine : <b className="text-red-600">+{computed.captainBonus}</b>
              {view.captainName ? (
                <span className="text-slate-400"> (×{computed.multiplier} sur {captain ? view.rows.find((r) => r.playerId === captain)?.name ?? view.captainName : '—'})</span>
              ) : (
                <span className="text-amber-600"> (aucun capitaine — clique « C »)</span>
              )}
            </span>
            <span>·</span>
            <span>Banc (info) : <b className="text-slate-800">{computed.benchPoints}</b></span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleToken}
              aria-pressed={tripleCaptain}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${tripleCaptain ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <Target className="h-3.5 w-3.5" /> Triple Captain {tripleCaptain ? 'ACTIVÉ (×3)' : '×3 (1/saison)'}
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:text-rose-600">
                  <RefreshCw className="h-3.5 w-3.5" /> Réinitialiser J{view.round}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Effacer les saisies live de J{view.round} ?</AlertDialogTitle>
                  <AlertDialogDescription>Les points saisis pour cette journée seront supprimés.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={resetRound} className="bg-rose-600 text-white hover:bg-rose-700">Effacer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Le banc est informatif : les remplacements automatiques sont appliqués par le jeu à la clôture de la journée.
          </p>
        </CardContent>
      </Card>

      {/* Titulaires */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Titulaires</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">{starters.map((r) => playerRow(r, false))}</CardContent>
      </Card>

      {/* Banc */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-400">Banc</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">{bench.map((r) => playerRow(r, true))}</CardContent>
      </Card>

      {/* Classement simulé */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-4 w-4 text-amber-500" /> Classement simulé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {computed.sim.map((s) => (
            <div key={s.name} data-testid={`sim-${s.name}`} className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 ${s.isUser ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}>
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${s.rank === 1 ? 'bg-amber-100 text-amber-700' : s.isUser ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{s.rank}</span>
                {s.name}
                {s.isUser && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">TOI</span>}
                {s.moved && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">position live</span>}
              </p>
              <p className="text-sm font-black tabular-nums text-slate-900">
                {s.projectedTotal ?? s.baseTotal ?? '?'}
                {s.isUser && s.liveRoundPoints != null && <span className="ml-1.5 text-xs font-semibold text-emerald-600">(+{s.liveRoundPoints} live)</span>}
              </p>
            </div>
          ))}
          <p className="flex items-start gap-1.5 pt-1 text-[11px] text-slate-400">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Tes points live s’ajoutent à ton total enregistré. Les rivaux restent à leur dernier total saisi.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
