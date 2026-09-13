import { NextResponse } from 'next/server'
import { getFixtures } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getFixtures())
  } catch (e) {
    console.error('fixtures error', e)
    return NextResponse.json({ error: 'Erreur moteur (fixtures)' }, { status: 500 })
  }
}
