import { NextResponse } from 'next/server'
import { deleteTransfer, getManagerDetail, saveTransfer } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('manager') ?? 'vital_gdb'
    const detail = await getManagerDetail(slug)
    if (!detail) return NextResponse.json({ error: 'Manager introuvable' }, { status: 404 })
    return NextResponse.json({ transfers: detail.transfers })
  } catch (e) {
    console.error('transfers GET error', e)
    return NextResponse.json({ error: 'Erreur lecture transferts' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body?.managerId || !body?.round) {
      return NextResponse.json({ error: 'managerId et round requis' }, { status: 400 })
    }
    await saveTransfer({
      managerId: body.managerId,
      round: Number(body.round),
      outPlayerId: body.outPlayerId ?? null,
      inPlayerId: body.inPlayerId ?? null,
      note: body.note ?? null,
      applyToSquad: body.applyToSquad !== false,
    })
    const detail = await getManagerDetail(body.managerSlug ?? 'vital_gdb')
    return NextResponse.json({ ok: true, transfers: detail?.transfers ?? [] })
  } catch (e) {
    console.error('transfers POST error', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur enregistrement transfert' }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    await deleteTransfer(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('transfers DELETE error', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur suppression' }, { status: 400 })
  }
}
