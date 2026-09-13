import { NextResponse } from 'next/server'
import { buildLeagueData, getCoachData } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getCoachData()
    return NextResponse.json(buildLeagueData(data))
  } catch (e) {
    console.error('league error', e)
    return NextResponse.json({ error: 'Erreur de chargement' }, { status: 500 })
  }
}
