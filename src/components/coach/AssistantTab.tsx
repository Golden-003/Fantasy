'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { DiffBadge, PosBadge, fr } from '@/components/coach/ui-helpers'
import type { AnalysisPayload } from '@/lib/coach/analysis'
import {
  AlertTriangle, ArrowRight, Bot, CalendarDays, Crown, Database, Loader2, MessageSquare,
  RefreshCw, SendHorizonal, Sparkles, Swords, TrendingUp, ArrowRightLeft,
} from 'lucide-react'

// ── Briefing ───────────────────────────────────────────────────
function SyncBadge({ a }: { a: AnalysisPayload | null }) {
  if (!a?.sync.lastAt) return <span className="text-[11px] text-slate-400">Jamais synchronisé</span>
  const d = new Date(a.sync.lastAt)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  const label = mins < 1 ? "à l'instant" : mins < 60 ? `il y a ${mins} min` : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
      <Database className="h-3 w-3" /> Données officielles : {label} · {a.sync.players} joueurs
    </span>
  )
}

function PredictionCard({ a }: { a: AnalysisPayload }) {
  const p = a.prediction
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-red-600" /> Sélection prédite — J{a.round}
          {a.roundDate && <span className="text-xs font-normal text-slate-500">{a.roundDate}</span>}
          {p && <span className="ml-auto text-xs font-normal text-slate-500">formation {p.formation}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!p ? (
          <p className="text-sm text-slate-500">Effectif incomplet (15 joueurs requis) — complète-le dans Mon équipe pour activer la prédiction.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Projection J{a.round}</p>
                <p className="text-2xl font-black tabular-nums text-slate-900">
                  {fr(p.projectedLow)} <span className="text-sm font-medium text-slate-400">à</span> {fr(p.projectedHigh)} <span className="text-sm font-medium text-slate-500">pts</span>
                </p>
              </div>
              {p.captain && (
                <div className="border-l border-slate-200 pl-4">
                  <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400"><Crown className="h-3 w-3" /> Capitaine prédit</p>
                  <p className="text-sm font-bold text-slate-900">{p.captain.name} <span className="font-normal text-slate-500">· {p.captain.fixture}</span></p>
                  <p className="text-xs text-slate-500">proj. {fr(p.captain.projected)} pt ×2 — {p.captain.difficulty.toLowerCase()}</p>
                </div>
              )}
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {p.players.map((pl) => (
                <div key={pl.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${pl.captain ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
                  <PosBadge pos={pl.position} />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{pl.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{pl.fixturesNext[0]?.label ?? '—'}</span>
                  <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums text-slate-900">{fr(pl.projected)}</span>
                </div>
              ))}
            </div>
            {p.risks.length > 0 && (
              <div className="space-y-1">
                {p.risks.map((r, i) => (
                  <p key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {r}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function CaptainMatrix({ a }: { a: AnalysisPayload }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Crown className="h-4 w-4 text-slate-400" /> Matrice capitaine — J{a.round}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {a.captainMatrix.length === 0 && <p className="text-sm text-slate-500">Effectif vide.</p>}
        {a.captainMatrix.map((c, i) => (
          <div key={c.name} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <span className="w-4 text-xs font-black text-slate-400">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{c.name}</span>
            <span className="hidden text-xs text-slate-500 sm:inline">{c.fixture}</span>
            <DiffBadge difficulty={c.difficulty} />
            <span className="w-14 text-right text-xs tabular-nums text-slate-500">proj. {fr(c.epNext)}</span>
            <span className="w-12 text-right text-xs tabular-nums text-slate-500">f. {fr(c.form)}</span>
            <span className="w-10 text-right text-sm font-black tabular-nums text-slate-900">{fr(c.score)}</span>
            {c.reasons[0] && <p className="w-full text-[11px] leading-snug text-slate-500">{c.reasons.join(' · ')}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function TransfersCard({ a }: { a: AnalysisPayload }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ArrowRightLeft className="h-4 w-4 text-slate-400" /> Moteur de transferts
          <span className="ml-auto text-xs font-normal text-slate-500">banque ~{fr(a.team.bank)} M</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {a.transfers.length === 0 && (
          <p className="text-sm text-slate-500">Aucun transfert prioritaire — l'effectif tient la route au vu des projections et du calendrier.</p>
        )}
        {a.transfers.map((t) => (
          <div key={t.out.name} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-rose-700">{t.out.name}</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-emerald-700">{t.in.name}</span>
              <span className="text-xs text-slate-500">{t.in.club}</span>
              <span className="ml-auto rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">gain ~{fr(t.gain)} pt</span>
            </div>
            <div className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-slate-500">
              <p><span className="font-semibold text-rose-700">Sortie :</span> {t.out.reasons.join(' · ')}</p>
              <p><span className="font-semibold text-emerald-700">Entrée :</span> {t.in.reasons.join(' · ')}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ComparisonsCard({ a }: { a: AnalysisPayload }) {
  const myValue = a.team.squadValue
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Swords className="h-4 w-4 text-slate-400" /> Comparaisons d'équipes
          <span className="ml-auto text-xs font-normal text-slate-500">ton effectif : {fr(myValue)} M</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {a.comparisons.map((c) => {
          const maxV = Math.max(myValue, c.squadValue ?? 0) || 1
          return (
            <div key={c.slug} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                {c.star && <span className="text-[11px] text-slate-500">star : {c.star}</span>}
                <span className="ml-auto text-xs tabular-nums text-slate-500">
                  onze projeté : <b className="text-slate-900">{c.xiProjected != null ? fr(c.xiProjected) : '—'}</b> pts
                </span>
              </div>
              {c.squadValue != null && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(100, (myValue / maxV) * 100)}%` }} />
                    </div>
                    <span className="w-14 text-right text-[10px] tabular-nums text-slate-400">toi {fr(myValue)} M</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-slate-400" style={{ width: `${Math.min(100, ((c.squadValue ?? 0) / maxV) * 100)}%` }} />
                    </div>
                    <span className="w-14 text-right text-[10px] tabular-nums text-slate-400">lui {fr(c.squadValue)} M</span>
                  </div>
                </div>
              )}
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{c.verdict}</p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function FixturesCard({ a }: { a: AnalysisPayload }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-slate-400" /> Calendrier — 3 prochaines journées
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {a.fixtures.map((r) => (
          <div key={r.round}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Journée {r.round}</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {r.matches.map((f) => (
                <div key={f.club} className="flex items-center gap-2 rounded border border-slate-100 px-2 py-1 text-xs text-slate-600">
                  <span className="min-w-0 flex-1 truncate">{f.club} <span className="text-slate-400">{f.isHome ? 'vs' : '@'}</span> {f.opponent}</span>
                  <DiffBadge difficulty={f.difficulty} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Chat ───────────────────────────────────────────────────────
interface Msg { role: 'user' | 'assistant'; content: string }

function Chat({ a }: { a: AnalysisPayload | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Coach, je suis branché sur la base complète (joueurs, calendrier, effectifs rivaux). Demande-moi capitaine, transferts, une analyse de rival ou les règles.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  async function send(text: string) {
    const message = text.trim()
    if (!message || loading) return
    const history = msgs.filter((m) => m !== msgs[0]).slice(-6)
    setMsgs((m) => [...m, { role: 'user', content: message }])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/coach/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      })
      const d = await res.json()
      setMsgs((m) => [...m, { role: 'assistant', content: d.reply ?? (d.error ?? 'Erreur inconnue') }])
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Connexion perdue avec l’assistant. Réessaie.' }])
    } finally {
      setLoading(false)
    }
  }

  const round = a?.round
  const QUICK = [
    `Qui mettre capitaine pour la J${round ?? 5} ?`,
    'Quels transferts faire avant la clôture ?',
    'Analyse nik Leroy : comment rattraper les points ?',
    'Comment marchent les tokens ?',
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4 text-slate-400" /> Demande-lui ce que tu veux
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[380px] space-y-3 overflow-y-auto p-4">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'rounded-br-sm bg-slate-900 text-white'
                    : 'rounded-bl-sm border border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyse en cours…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-100 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pose ta question de coach…"
              disabled={loading}
              className="flex-1 border-slate-200 bg-white"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-700 disabled:opacity-40"
              aria-label="Envoyer"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
            <MessageSquare className="h-3 w-3" /> Réponses ancrées sur les données enregistrées — jamais inventées.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Onglet ─────────────────────────────────────────────────────
export default function AssistantTab() {
  const [a, setA] = useState<AnalysisPayload | null>(null)
  const [err, setErr] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setErr(false)
    fetch('/api/coach/analysis')
      .then((r) => r.json())
      .then((d) => setA(d.error ? null : d))
      .catch(() => setErr(true))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function refresh() {
    if (syncing) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      const d = await res.json()
      if (d.error) setSyncMsg(d.error)
      else if (d.skipped) setSyncMsg('Déjà à jour il y a moins d’une minute.')
      else setSyncMsg(`Synchronisé : ${d.playersUpdated + d.playersCreated} joueurs, ${d.fixturesWritten} lignes calendrier, J${d.currentRound}.`)
      load()
    } catch {
      setSyncMsg('Synchronisation impossible — réessaie.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* En-tête analyste */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <TrendingUp className="h-4 w-4 text-red-600" /> Analyste — J{a?.round ?? '…'}
            </p>
            <SyncBadge a={a} />
          </div>
          <button
            onClick={refresh}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Actualiser
          </button>
        </CardContent>
        {syncMsg && <p className="px-4 pb-3 text-xs text-slate-500">{syncMsg}</p>}
        {err && <p className="px-4 pb-3 text-xs text-rose-600">Analyse indisponible — vérifie la base de données.</p>}
      </Card>

      {!a ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <PredictionCard a={a} />
          <CaptainMatrix a={a} />
          <TransfersCard a={a} />
          <ComparisonsCard a={a} />
          <FixturesCard a={a} />
        </>
      )}

      <Chat a={a} />
    </div>
  )
}
