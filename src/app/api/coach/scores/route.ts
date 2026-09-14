import { NextResponse } from 'next/server'
import { getManagerDetail, saveRoundScore } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body?.managerId || !body?.round) {
      return NextResponse.json({ error: 'managerId et round requis' }, { status: 400 })
    }
    const points = body.points === null || body.points === '' ? null : Number(body.points)
    if (points != null && !Number.isFinite(points)) {
      return NextResponse.json({ error: 'Points invalides' }, { status: 400 })
    }
    await saveRoundScore(body.managerId, Number(body.round), points)
    const detail = await getManagerDetail(body.managerSlug ?? 'vital_gdb')
    return NextResponse.json({ ok: true, scores: detail?.scores ?? [] })
  } catch (e) {
    console.error('scores error', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur enregistrement score' }, { status: 400 })
  }
}
