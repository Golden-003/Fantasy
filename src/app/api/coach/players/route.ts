import { NextResponse } from 'next/server'
import { getCoachData } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getCoachData()
    return NextResponse.json({
      players: data.players,
      nextGw: data.nextGw,
      seasonLabel: data.seasonLabel,
    })
  } catch (e) {
    console.error('players error', e)
    return NextResponse.json({ error: 'Erreur de chargement' }, { status: 500 })
  }
}
