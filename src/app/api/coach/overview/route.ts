import { NextResponse } from 'next/server'
import { getCoachData, NEED_SETUP } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getCoachData()
    return NextResponse.json({
      me: data.me,
      alerts: data.alerts,
      transfers: data.transfers,
      nextGw: data.nextGw,
      seasonLabel: data.seasonLabel,
      live: data.live,
      syncedAt: data.syncedAt,
    })
  } catch (e) {
    if (e instanceof Error && e.message === NEED_SETUP) {
      return NextResponse.json({ error: NEED_SETUP })
    }
    console.error('overview error', e)
    return NextResponse.json({ error: 'Erreur de chargement des données réelles FPL' }, { status: 500 })
  }
}
