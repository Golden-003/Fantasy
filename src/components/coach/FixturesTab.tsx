'use client'

import type { TeamFixtureRow } from '@/lib/coach/types'
import { DifficultyChip } from './ui-helpers'

const scoreCls = (s: number) => (s >= 60 ? 'text-emerald-400' : s >= 45 ? 'text-amber-300' : 'text-red-400')

export function FixturesTab({ teams }: { teams: TeamFixtureRow[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Fixture Score = qualité du calendrier des 5 prochaines journées (0-100). Plus c&apos;est vert, plus les adversaires à venir sont abordables. 1 = facile, 5 = très difficile.
      </p>
      <div className="max-h-[64vh] space-y-1.5 overflow-y-auto pr-1">
        {teams.map((t, i) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 sm:flex-nowrap">
            <span className="w-6 text-center text-xs font-bold text-slate-500">{i + 1}</span>
            <span className="w-28 shrink-0 text-sm font-semibold text-slate-200">{t.name}</span>
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {t.fixtures.map((f) => (
                <span key={f.gw} className="inline-flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-300">
                  <span className="text-slate-500">J{f.gw}</span>
                  <span className="font-medium">{f.opp}{f.venue === 'A' ? '@' : ''}</span>
                  <DifficultyChip d={f.difficulty} />
                </span>
              ))}
            </div>
            <div className="w-24 shrink-0">
              <div className={`text-right text-sm font-bold ${scoreCls(t.fixtureScore)}`}>{Math.round(t.fixtureScore)}/100</div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${t.fixtureScore >= 60 ? 'bg-emerald-500' : t.fixtureScore >= 45 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${t.fixtureScore}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
