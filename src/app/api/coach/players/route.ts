import { NextResponse } from 'next/server'
import { getPlayerDetail, getPlayersAll } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (id) {
      const detail = await getPlayerDetail(id)
      if (!detail) return NextResponse.json({ error: 'Joueur introuvable' }, { status: 404 })
      return NextResponse.json(detail)
    }
    const players = await getPlayersAll()
    return NextResponse.json({ players })
  } catch (e) {
    console.error('players error', e)
    return NextResponse.json({ error: 'Erreur base joueurs' }, { status: 500 })
  }
}
