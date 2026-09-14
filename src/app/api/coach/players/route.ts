import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getMarketTargets } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [players, targets] = await Promise.all([
      db.player.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
      getMarketTargets(),
    ])
    return NextResponse.json({ players, targets })
  } catch (e) {
    console.error('players error', e)
    return NextResponse.json({ error: 'Erreur moteur (players)' }, { status: 500 })
  }
}
