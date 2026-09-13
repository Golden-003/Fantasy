'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { LeagueView } from '@/lib/coach/types'
import { Crown, Camera, Swords } from 'lucide-react'

export default function LeagueTab() {
  const [lg, setLg] = useState<LeagueView | null>(null)

  useEffect(() => {
    fetch('/api/coach/league').then((r) => r.json()).then(setLg).catch(console.error)
  }, [])

  if (!lg) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const max = Math.max(...lg.standings.map((s) => s.total ?? 0))
  const min = Math.min(...lg.standings.map((s) => s.total ?? 0))

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Swords className="h-4 w-4 text-violet-300" /> {lg.name} — classement officiel après R4
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lg.standings.map((s) => {
            const width = max === min ? 100 : 30 + ((s.total ?? 0) - min) / (max - min) * 70
            return (
              <div key={s.name} className={`rounded-lg border p-3 ${s.isUser ? 'border-violet-500/40 bg-violet-500/5' : 'border-border bg-zinc-900/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${s.rank === 1 ? 'bg-amber-400 text-black' : s.isUser ? 'bg-violet-500 text-white' : 'bg-zinc-700 text-zinc-200'}`}>{s.rank}</span>
                    {s.name}
                    {s.isUser && <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">TOI</span>}
                  </p>
                  <p className="text-sm font-black tabular-nums">{s.total ?? '?'} <span className="text-xs font-normal text-zinc-500">pts</span></p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${s.isUser ? 'bg-violet-500' : s.rank === 1 ? 'bg-amber-400' : 'bg-zinc-600'}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                  {s.r4Known ? <span>R4 : <b className="text-zinc-300">{s.r4}</b></span> : <span className="text-amber-300/80">R4 individuel à confirmer</span>}
                  {!s.historyKnown && <span>· R1-R3 en attente de captures</span>}
                  {s.name === 'nik Leroy' && <span className="text-rose-300">· a fait 108 en R4 (+37 sur toi)</span>}
                </div>
              </div>
            )
          })}
          <p className="pt-1 text-[11px] text-zinc-500">
            Source : ta capture « Ligues » du 13 sept 21:22 · Moyenne R4 affichée dans l’app : {String(lg.averageR4Displayed).replace('.', ',')} · Meilleur score affiché : {lg.bestR4Displayed} (probablement global, à confirmer)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-amber-300" /> Données manquantes — le rituel des captures
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-zinc-400">L’app Sofascore est derrière une connexion : personne ne peut lire la ligue à ta place. À chaque journée, envoie-moi :</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-zinc-300">
            <li><b>Capture A</b> — ton équipe (onglet « Mon équipe »)</li>
            <li><b>Capture B</b> — le classement (onglet « Ligues »)</li>
            <li><b>Captures C</b> — si l’app permet d’ouvrir le XI d’un rival : une par rival (nik Leroy, Donatien_10, Aziza FC, Zarés JR)</li>
          </ol>
          <p className="pt-1 text-xs text-zinc-500">Chaque capture alimente l’historique réel : formes, tendances et guerre d’analyse entre managers.</p>
        </CardContent>
      </Card>

      <Card className="border-rose-500/25 bg-rose-500/5">
        <CardContent className="p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-300">
            <Crown className="h-4 w-4" /> État de la course
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            <b>{lg.leaderName}</b> mène avec {lg.standings[0].total} pts. Tu es {lg.myRank}ᵉ à <b className="text-rose-300">{lg.gapToLeader}</b> pts du sommet et à <b className="text-emerald-300">+{lg.gapToLast}</b> du dernier (Zarés JR). R4 t’a coûté −37 pts face au leader : la réponse se joue dès le 18 septembre.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
