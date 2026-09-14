import { NextRequest, NextResponse } from 'next/server'
import { getLive, resetLive, saveLive, getCurrentRound, type LiveSaveInput } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

// GET /api/coach/live?round=5 → état du Match Center (défaut = journée courante)
export async function GET(req: NextRequest) {
  try {
    const param = req.nextUrl.searchParams.get('round')
    const round = param ? Number(param) : await getCurrentRound()
    if (!Number.isInteger(round) || round < 1 || round > 38) {
      return NextResponse.json({ error: 'Journée invalide (1-38)' }, { status: 400 })
    }
    return NextResponse.json(await getLive(round))
  } catch (e) {
    console.error('live GET error', e)
    return NextResponse.json({ error: 'Erreur moteur (live)' }, { status: 500 })
  }
}

// POST /api/coach/live { round, tripleCaptain?, captainPlayerId?, entries? } → sauvegarde + état recalculé
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { round: number } & LiveSaveInput
    const round = Number(body?.round)
    if (!Number.isInteger(round) || round < 1 || round > 38) {
      return NextResponse.json({ error: 'Journée invalide (1-38)' }, { status: 400 })
    }
    const view = await saveLive(round, {
      tripleCaptain: body.tripleCaptain,
      captainPlayerId: body.captainPlayerId,
      entries: Array.isArray(body.entries) ? body.entries : undefined,
    })
    return NextResponse.json(view)
  } catch (e) {
    console.error('live POST error', e)
    return NextResponse.json({ error: 'Sauvegarde live impossible' }, { status: 500 })
  }
}

// DELETE /api/coach/live?round=5 → réinitialise les saisies de la journée
export async function DELETE(req: NextRequest) {
  try {
    const round = Number(req.nextUrl.searchParams.get('round') ?? 0)
    if (!Number.isInteger(round) || round < 1 || round > 38) {
      return NextResponse.json({ error: 'Journée invalide (1-38)' }, { status: 400 })
    }
    await resetLive(round)
    return NextResponse.json(await getLive(round))
  } catch (e) {
    console.error('live DELETE error', e)
    return NextResponse.json({ error: 'Reset live impossible' }, { status: 500 })
  }
}
