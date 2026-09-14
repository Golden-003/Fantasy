import { NextResponse } from 'next/server'
import { runSync, getLastSync } from '@/lib/coach/fplsync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  try {
    // anti-spam : pas deux sync complets à moins de 45 s
    const last = await getLastSync()
    if (last?.at) {
      const ageMs = Date.now() - new Date(last.at).getTime()
      if (ageMs < 45_000) {
        return NextResponse.json({ skipped: true, lastAt: last.at, message: 'Données déjà à jour' })
      }
    }
    const result = await runSync()
    return NextResponse.json(result)
  } catch (e) {
    console.error('sync error', e)
    return NextResponse.json({ error: 'Synchronisation impossible — réessaie' }, { status: 500 })
  }
}

export async function GET() {
  const last = await getLastSync()
  return NextResponse.json({ lastAt: last?.at ?? null, currentRound: last?.currentRound ?? null })
}
