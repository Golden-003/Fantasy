'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { FixtureView } from '@/lib/coach/types'
import { ROUND_DATES } from '@/lib/coach/rules'
import { DiffBadge } from './ui-helpers'
import { CalendarDays, MapPin } from 'lucide-react'

export default function FixturesTab() {
  const [data, setData] = useState<{ rounds: Record<number, FixtureView[]>; officialRuns: string } | null>(null)

  useEffect(() => {
    fetch('/api/coach/fixtures').then((r) => r.json()).then(setData).catch(console.error)
  }, [])

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const rounds = [5, 6, 7, 8].filter((r) => data.rounds[r]?.length)

  return (
    <div className="space-y-4">
      <Card className="border-violet-500/25 bg-violet-500/5">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-violet-300">Séries officiellement les plus clémentes R4-8</p>
          <p className="mt-1 text-sm text-zinc-300">{data.officialRuns}</p>
          <p className="mt-2 text-[11px] text-zinc-500">Source : article officiel Sofascore du 11 sept 2026. Les difficultés ci-dessous sont des estimations transparentes (domicile, adversaire promu/fort) à partir de ces fixtures réelles.</p>
        </CardContent>
      </Card>

      {rounds.map((r) => (
        <Card key={r}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-zinc-400" /> Round {r}
              <span className="text-xs font-normal text-zinc-500">· {ROUND_DATES[r]}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5 sm:grid-cols-2">
            {data.rounds[r].map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-zinc-900/30 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <span className="font-semibold">{f.club}</span>
                    <span className="text-zinc-400"> {f.isHome ? 'vs' : '@'} {f.opponent}</span>
                  </p>
                  <p className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <MapPin className="h-2.5 w-2.5" /> {f.isHome ? 'Domicile' : 'Extérieur'}
                  </p>
                </div>
                <DiffBadge difficulty={f.difficulty} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <p className="px-1 text-[11px] text-zinc-500">
        Fixtures non publiées (Man United, Leeds, Bournemouth, etc. pour R5) : affichées « INCONNU » dès que concernées — elles seront ajoutées via le prochain article officiel ou une capture. Aucune fixture inventée.
      </p>
    </div>
  )
}
