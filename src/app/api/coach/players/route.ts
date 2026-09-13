import { NextResponse } from 'next/server'
import { getPlayersData } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getPlayersData()
    return NextResponse.json({ players: data.players, nextGw: data.nextGw, hasOwnership: data.hasOwnership })
  } catch (e) {
    console.error('players error', e)
    return NextResponse.json({ error: 'Erreur de chargement des joueurs' }, { status: 500 })
  }
}
