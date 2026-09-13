import { NextResponse } from 'next/server'
import { getCoachData, NEED_SETUP } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getCoachData()
    return NextResponse.json(data.league)
  } catch (e) {
    if (e instanceof Error && e.message === NEED_SETUP) {
      return NextResponse.json({ error: NEED_SETUP })
    }
    console.error('league error', e)
    return NextResponse.json({ error: 'Erreur de chargement de la ligue' }, { status: 500 })
  }
}
