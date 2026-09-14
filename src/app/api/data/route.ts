import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Journal d'ingestion : traçabilité complète des données réelles
export async function GET() {
  try {
    const events = await db.dataEvent.findMany({ orderBy: { at: 'desc' } })
    const [players, priced, fixtures, scores] = await Promise.all([
      db.player.count(),
      db.player.count({ where: { price: { not: null } } }),
      db.fixture.count(),
      db.roundScore.count(),
    ])
    return NextResponse.json({
      events,
      quality: { players, priced, fixtures, scores },
    })
  } catch (e) {
    console.error('data error', e)
    return NextResponse.json({ error: 'Erreur moteur (data)' }, { status: 500 })
  }
}
