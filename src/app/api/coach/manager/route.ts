import { NextResponse } from 'next/server'
import { getManagerDetail } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug') ?? 'vital_gdb'
    const detail = await getManagerDetail(slug)
    if (!detail) return NextResponse.json({ error: 'Manager introuvable' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (e) {
    console.error('manager error', e)
    return NextResponse.json({ error: 'Erreur moteur (manager)' }, { status: 500 })
  }
}
