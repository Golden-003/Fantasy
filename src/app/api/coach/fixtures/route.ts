import { NextResponse } from 'next/server'
import { getFixturesData } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getFixturesData()
    return NextResponse.json({ teams: data.teams, nextGw: data.nextGw, seasonLabel: data.seasonLabel })
  } catch (e) {
    console.error('fixtures error', e)
    return NextResponse.json({ error: 'Erreur de chargement du calendrier' }, { status: 500 })
  }
}
