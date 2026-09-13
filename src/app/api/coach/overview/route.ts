import { NextResponse } from 'next/server'
import { getCoachData } from '@/lib/coach/engine'

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
    })
  } catch (e) {
    console.error('overview error', e)
    return NextResponse.json({ error: 'Erreur de chargement' }, { status: 500 })
  }
}
