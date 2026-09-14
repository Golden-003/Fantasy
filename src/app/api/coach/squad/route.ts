import { NextResponse } from 'next/server'
import { saveSquad, type SquadSlotInput } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const managerId: string | undefined = body?.managerId
    const slots: SquadSlotInput[] | undefined = body?.slots
    if (!managerId || !Array.isArray(slots)) {
      return NextResponse.json({ error: 'managerId et slots requis' }, { status: 400 })
    }
    await saveSquad(managerId, slots)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('squad error', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur enregistrement effectif' }, { status: 400 })
  }
}
