import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCoachData, attackDifficulty } from '@/lib/coach/engine'
import type { TeamFixtureRow } from '@/lib/coach/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getCoachData()
    const teams = await db.team.findMany()
    const fixtures = await db.fixture.findMany({ orderBy: { gw: 'asc' } })
    const teamById = new Map(teams.map((x) => [x.id, x]))
    const nextGw = data.nextGw

    const rows: TeamFixtureRow[] = teams.map((t) => ({
      id: t.id,
      name: t.name,
      short: t.shortName,
      fixtureScore: data.teamScores.get(t.id) ?? 0,
      fixtures: fixtures
        .filter((f) => (f.homeTeamId === t.id || f.awayTeamId === t.id) && f.gw >= nextGw && f.gw < nextGw + 5)
        .map((f) => {
          const isHome = f.homeTeamId === t.id
          const opp = teamById.get(isHome ? f.awayTeamId : f.homeTeamId)!
          return {
            gw: f.gw,
            opp: opp.shortName,
            venue: (isHome ? 'H' : 'A') as 'H' | 'A',
            difficulty: attackDifficulty(opp.def, isHome ? 'H' : 'A'),
          }
        }),
    }))

    rows.sort((a, b) => b.fixtureScore - a.fixtureScore)
    return NextResponse.json({ teams: rows, nextGw })
  } catch (e) {
    console.error('fixtures error', e)
    return NextResponse.json({ error: 'Erreur de chargement' }, { status: 500 })
  }
}
