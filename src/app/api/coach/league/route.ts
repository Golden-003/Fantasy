import { NextResponse } from 'next/server'
import { getLeague } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getLeague())
  } catch (e) {
    console.error('league error', e)
    return NextResponse.json({ error: 'Erreur moteur (league)' }, { status: 500 })
  }
}
