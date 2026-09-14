'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { LiveStandingRow, LiveView } from '@/lib/coach/types'
import { CloudUpload, Crown, Info, Radio, RefreshCw, Zap } from 'lucide-react'

const ROUND_OPTIONS = [
  { round: 5, date: '18 sept.' },
  { round: 6, date: '10 oct.' },
  { round: 7, date: '17 oct.' },
  { round: 8, date: '23 oct.' },
]

const POS_CHIP: Record<string, string> = {
  G: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  D: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
  M: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  A: 'bg-rose-400/15 text-rose-300 border-rose-400/30',
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

  // ── Recalcul INSTANTANÉ côté client (le temps réel du coach) ──
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

    // Classement simulé recalculé en direct
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
      <div key={row.playerId} data-testid={`live-row-${row.name}`} className={`rounded-lg border p-3 ${isBench ? 'border-border/60 bg-zinc-900/30 opacity-80' : 'border-border bg-zinc-900/40'}`}>
        <div className="flex items-center gap-2">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-black ${POS_CHIP[row.position] ?? ''}`}>{row.position}</span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
              {row.name}
              {!row.clubConfirmed && <span className="shrink-0 rounded bg-amber-500/10 px-1 text-[9px] font-medium text-amber-300">club ?</span>}
              {!isBench && (
                <button
                  onClick={() => pickCaptain(row.playerId)}
                  aria-pressed={isCap}
                  aria-label={`Capitaine ${row.name}`}
                  className={`ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition ${isCap ? 'bg-violet-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.6)]' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'}`}
                >
                  C
                </button>
              )}
            </p>
            <p className="truncate text-[11px] text-zinc-500">
              {row.club}{row.fixture ? ` · R${view.round} ${row.fixture}` : ' · fixture R5 non publiée'}{row.pointsR4 != null ? ` · R4 : ${row.pointsR4} pts` : ''}
            </p>
          </div>
          <Input
            inputMode="numeric"
            placeholder="pts"
            value={draft[row.playerId] ?? ''}
            onChange={(e) => setPoints(row.playerId, e.target.value)}
            aria-label={`Points live de ${row.name}`}
            className="h-9 w-16 shrink-0 border-border bg-zinc-950/60 text-center text-sm font-bold tabular-nums"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bandeau rituel 30 s */}
      <Card className="border-violet-500/25 bg-violet-500/5">
        <CardContent className="p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-violet-200">
            <Radio className="h-4 w-4 animate-pulse text-rose-400" /> Match Center — ton canal temps réel
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300">
            Sofascore bloque les serveurs (Cloudflare) : <b>ton app Sofascore reste la source live</b>.
            Après chaque match, recopie les notes de tes joueurs ici en ~30 s — le score live, le bonus capitaine
            et le classement de la ligue se recalculent instantanément. Pas de note dans l’app ? Laisse vide :
            elle compte comme « en attente ».
          </p>
        </CardContent>
      </Card>

      {/* Sélecteur de journée */}
      <div className="flex flex-wrap items-center gap-2">
        {ROUND_OPTIONS.map((o) => (
          <button
            key={o.round}
            onClick={() => changeRound(o.round)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${round === o.round ? 'border-violet-500 bg-violet-600 text-white' : 'border-border bg-zinc-900/50 text-zinc-400 hover:text-zinc-200'}`}
          >
            R{o.round} <span className={`text-[10px] font-normal ${round === o.round ? 'text-violet-200' : 'text-zinc-500'}`}>{o.date}</span>
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-500">
          {saveState === 'saving' && <><CloudUpload className="h-3.5 w-3.5 animate-pulse" /> sauvegarde…</>}
          {saveState === 'saved' && lastUp && <>✓ sauvegardé à {lastUp}</>}
          {saveState === 'dirty' && <span className="text-amber-300">modifications en attente…</span>}
          {saveState === 'idle' && lastUp && <>dernière saisie {lastUp}</>}
        </span>
      </div>

      {/* Résumé live */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-amber-300" /> Score live R{view.round}
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-normal text-zinc-400">{computed.startersEntered}/{computed.startersTotal} titulaires saisis</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-border bg-zinc-900/40 p-3">
              <p className="text-2xl font-black tabular-nums text-violet-300" data-testid="live-round-points">{computed.liveRoundPoints}</p>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">pts live journée</p>
            </div>
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
              <p className="text-2xl font-black tabular-nums text-white" data-testid="live-projected">{computed.projectedTotal}</p>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">total projeté</p>
            </div>
            <div className="rounded-lg border border-border bg-zinc-900/40 p-3">
              <p className="text-2xl font-black tabular-nums text-zinc-300">{view.live.baseTotal}</p>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">base (après R4)</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            <span>Titulaires : <b className="text-zinc-200">{computed.startersPoints}</b></span>
            <span>·</span>
            <span className="flex items-center gap-1">
              Bonus capitaine : <b className="text-violet-300">+{computed.captainBonus}</b>
              {view.captainName ? <span className="text-zinc-500">(×{computed.multiplier} sur {captain ? view.rows.find((r) => r.playerId === captain)?.name ?? view.captainName : 'aucun'})</span> : <span className="text-amber-300">(aucun capitaine choisi — clique « C »)</span>}
            </span>
            <span>·</span>
            <span>Banc (info) : <b className="text-zinc-200">{computed.benchPoints}</b></span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleToken}
              aria-pressed={tripleCaptain}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${tripleCaptain ? 'border-amber-400 bg-amber-400/15 text-amber-300' : 'border-border bg-zinc-900/50 text-zinc-400 hover:text-zinc-200'}`}
            >
              🎯 Token Triple Captain {tripleCaptain ? 'ACTIVÉ (×3)' : '— ×3 (1/saison)'}
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-zinc-500 hover:text-rose-300">
                  <RefreshCw className="h-3.5 w-3.5" /> Réinitialiser R{view.round}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Effacer les saisies live de R{view.round} ?</AlertDialogTitle>
                  <AlertDialogDescription>Les points recopiés pour cette journée seront supprimés. Utile pour repartir à zéro ou corriger une saisie erronée en masse.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={resetRound} className="bg-rose-600 text-white hover:bg-rose-700">Effacer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="text-[11px] text-zinc-600">Le banc est affiché à titre indicatif : les remplacements automatiques (joueur à 0 pt non entré) sont appliqués par Sofascore à la clôture de la journée.</p>
        </CardContent>
      </Card>

      {/* Titulaires */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Titulaires — recopie les notes depuis l’app</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">{starters.map((r) => playerRow(r, false))}</CardContent>
      </Card>

      {/* Banc */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-zinc-400">Banc (info)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">{bench.map((r) => playerRow(r, true))}</CardContent>
      </Card>

      {/* Classement simulé */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-4 w-4 text-amber-300" /> Classement simulé — avec tes points live
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {computed.sim.map((s) => (
            <div key={s.name} data-testid={`sim-${s.name}`} className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 ${s.isUser ? 'border-violet-500/40 bg-violet-500/5' : 'border-border bg-zinc-900/40'}`}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${s.rank === 1 ? 'bg-amber-400 text-black' : s.isUser ? 'bg-violet-500 text-white' : 'bg-zinc-700 text-zinc-200'}`}>{s.rank}</span>
                {s.name}
                {s.isUser && <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">TOI</span>}
                {s.moved && <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">position live</span>}
              </p>
              <p className="text-sm font-black tabular-nums">
                {s.projectedTotal ?? s.baseTotal ?? '?'}
                {s.isUser && s.liveRoundPoints != null && <span className="ml-1.5 text-xs font-semibold text-emerald-300">(+{s.liveRoundPoints} live)</span>}
              </p>
            </div>
          ))}
          <p className="flex items-start gap-1.5 pt-1 text-[11px] text-zinc-500">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Simulation : tes points live s’ajoutent à ton total réel (capture R4). Les rivaux restent figés à leur dernier total connu — personne ne peut lire leurs scores live sans leur session Sofascore. Le classement officiel se mettra à jour à la clôture via tes captures.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
