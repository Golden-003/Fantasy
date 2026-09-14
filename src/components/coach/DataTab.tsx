'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RULES, SOURCES } from '@/lib/coach/rules'
import { Camera, Database, FileText, PencilLine, Radio, ScrollText, Scale, WifiOff } from 'lucide-react'

interface DataEvent {
  id: string
  at: string
  kind: string
  title: string
  detail: string
}

const KIND_STYLE: Record<string, { icon: typeof FileText; cls: string }> = {
  CAPTURE: { icon: Camera, cls: 'text-violet-300 border-violet-500/30 bg-violet-500/5' },
  ARTICLE: { icon: FileText, cls: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/5' },
  REGLE: { icon: Scale, cls: 'text-amber-300 border-amber-500/30 bg-amber-500/5' },
  SAISON: { icon: ScrollText, cls: 'text-sky-300 border-sky-500/30 bg-sky-500/5' },
  SAISIE: { icon: PencilLine, cls: 'text-rose-300 border-rose-500/30 bg-rose-500/5' },
}

export default function DataTab() {
  const [data, setData] = useState<{ events: DataEvent[]; quality: { players: number; priced: number; fixtures: number; scores: number } } | null>(null)

  useEffect(() => {
    fetch('/api/data').then((r) => r.json()).then(setData).catch(console.error)
  }, [])

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-violet-300" /> Qualité des données réelles
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Joueurs tracés', value: data.quality.players },
            { label: 'Prix sourcés', value: data.quality.priced },
            { label: 'Fixtures officielles', value: data.quality.fixtures },
            { label: 'Scores réels', value: data.quality.scores },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-zinc-900/40 p-3 text-center">
              <p className="text-2xl font-black text-violet-300">{s.value}</p>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">{s.label}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-rose-500/25 bg-rose-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4 text-rose-300" /> Comment les stats se mettent à jour — 3 canaux, 3 vitesses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
            <p className="font-semibold text-rose-200">① PENDANT les matchs — Match Center (onglet Live)</p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">
              L’app Sofascore sur ton téléphone est la seule source live (Cloudflare interdit aux serveurs d’y accéder).
              Tu recopies les notes de tes joueurs dans le Match Center en ~30 s après chaque match :
              score live, bonus capitaine (×2 / token ×3) et classement simulé se recalculent instantanément.
            </p>
          </div>
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
            <p className="font-semibold text-violet-200">② APRÈS la journée — le rituel des captures (chat)</p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">
              Tu m’envoies les captures A (ton équipe), B (classement de la ligue) et C (XI des rivaux si visible).
              Je les lis, je les archive dans la base avec leur source, et tout le moteur (formes, tendances, alertes)
              se met à jour avec les données officielles confirmées.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-zinc-900/40 p-3">
            <p className="flex items-center gap-1.5 font-semibold text-zinc-200"><WifiOff className="h-3.5 w-3.5" /> V2 — connecteur local (automatique)</p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">
              Ton navigateur, lui, passe le Cloudflare (c’est ta session). Un petit connecteur installé chez toi
              pourra synchroniser Sofascore automatiquement — zéro capture, zéro saisie. La V1 fonctionne sans lui.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Journal d’ingestion — d’où vient chaque donnée</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.events.map((e) => {
            const st = KIND_STYLE[e.kind] ?? KIND_STYLE.ARTICLE
            const Icon = st.icon
            return (
              <div key={e.id} className={`rounded-lg border p-3 ${st.cls}`}>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4 shrink-0" />
                  {e.title}
                  <span className="ml-auto shrink-0 text-[10px] font-normal text-zinc-500">{new Date(e.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {e.kind}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-300">{e.detail}</p>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Règles officielles 2026/27 (vérifiées)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-300">
          <ul className="space-y-1.5">
            <li>💰 Budget <b>{RULES.budget} M€</b> · effectif <b>{RULES.squadSize} joueurs</b> ({RULES.quota.G}G / {RULES.quota.D}D / {RULES.quota.M}M / {RULES.quota.A}A)</li>
            <li>🔁 <b>{RULES.freeTransfersPerRound} transferts gratuits / journée</b> · cumul max {RULES.transferBankMax} · extra −{RULES.extraTransferPenalty} pts</li>
            <li>🧢 Capitaine ×{RULES.captainMultiplier} · max 1 token par journée</li>
          </ul>
          <div className="space-y-1.5">
            {RULES.tokens.map((t) => (
              <div key={t.name} className="flex items-center justify-between rounded-lg border border-border bg-zinc-900/40 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-zinc-500">{t.effect}{t.note ? ` · ${t.note}` : ''}</p>
                </div>
                <span className="text-xs font-bold text-amber-300">×{t.perSeason}/saison</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500">{RULES.scoringNote}</p>
          <div className="space-y-1 border-t border-border pt-3 text-[11px] text-zinc-500">
            <p className="font-semibold text-zinc-400">Sources enregistrées :</p>
            <p>📎 {SOURCES.captures}</p>
            <p>📎 {SOURCES.articlePicks}</p>
            <p>📎 {SOURCES.articleRules}</p>
            <p>📎 {SOURCES.faq}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
