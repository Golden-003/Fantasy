import { NextResponse } from 'next/server'
import { getCaptainPicks, getTeam, getTransferFlags } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [team, captains, flags] = await Promise.all([getTeam(), getCaptainPicks(), getTransferFlags()])
    return NextResponse.json({ team, captains, flags })
  } catch (e) {
    console.error('team error', e)
    return NextResponse.json({ error: 'Erreur moteur (team)' }, { status: 500 })
  }
}
