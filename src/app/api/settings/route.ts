import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fpl from '@/lib/fpl/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const s = await db.settings.findUnique({ where: { id: 'default' } })
  return NextResponse.json({
    configured: !!(s?.teamId && s?.leagueId),
    teamId: s?.teamId ?? null,
    leagueId: s?.leagueId ?? null,
    hasCookie: !!s?.cookie,
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const teamId = parseInt(String(body?.teamId ?? ''), 10)
    const leagueId = parseInt(String(body?.leagueId ?? ''), 10)
    const cookie = typeof body?.cookie === 'string' && body.cookie.trim().length > 10 ? body.cookie.trim() : null

    if (!Number.isFinite(teamId) || teamId <= 0) {
      return NextResponse.json({ error: 'Team ID invalide — il doit s’agir du nombre dans l’URL FPL de ton équipe (/entry/XXXXX/…)' }, { status: 400 })
    }
    if (!Number.isFinite(leagueId) || leagueId <= 0) {
      return NextResponse.json({ error: 'League ID invalide — il doit s’agir du nombre dans l’URL du classement (/leagues-classic/XXXXX/…)' }, { status: 400 })
    }

    // Validation en direct contre l'API officielle FPL (réel, pas de simulacre)
    const [entry, league] = await Promise.all([
      fpl.getEntry(teamId).catch(() => null),
      fpl.getLeagueStandings(leagueId).catch(() => null),
    ])
    if (!entry) {
      return NextResponse.json({ error: `Team ID ${teamId} introuvable sur l'API officielle FPL. Vérifie l'URL /entry/${teamId}/` }, { status: 400 })
    }
    if (!league) {
      return NextResponse.json({ error: `League ID ${leagueId} introuvable. Vérifie l'URL /leagues-classic/${leagueId}/standings` }, { status: 400 })
    }
    const inLeague = league.standings.results.some((r) => r.entry === teamId)
    if (!inLeague) {
      return NextResponse.json({ error: `L'équipe « ${entry.name} » n'apparaît pas dans la ligue « ${league.league.name} ». Vérifie les deux IDs.` }, { status: 400 })
    }

    await db.settings.upsert({
      where: { id: 'default' },
      create: { id: 'default', teamId, leagueId, cookie },
      update: { teamId, leagueId, cookie },
    })
    fpl.invalidate('picks:')
    fpl.invalidate('league:')
    fpl.invalidate('entry:')

    return NextResponse.json({ ok: true, teamName: entry.name, leagueName: league.league.name })
  } catch (e) {
    console.error('settings error', e)
    return NextResponse.json({ error: 'Validation impossible — l’API FPL ne répond pas. Réessaie.' }, { status: 500 })
  }
}

export async function DELETE() {
  await db.settings.deleteMany({})
  fpl.invalidate('picks:')
  fpl.invalidate('league:')
  fpl.invalidate('entry:')
  return NextResponse.json({ ok: true })
}
