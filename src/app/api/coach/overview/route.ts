import { NextResponse } from 'next/server'
import { getOverview } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getOverview())
  } catch (e) {
    console.error('overview error', e)
    return NextResponse.json({ error: 'Erreur moteur (overview)' }, { status: 500 })
  }
}
