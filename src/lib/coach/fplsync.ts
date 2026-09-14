// ═══════════════════════════════════════════════════════════════
// SYNC FPL — rafraîchissement complet depuis l'API officielle
// fantasy.premierleague.com (accès public).
//
// Utilisé par scripts/sync-fpl.ts (CLI) et /api/sync (temps réel).
// - 658+ joueurs : stats, statuts, projections, prix de référence
// - Calendrier : 380 matchs × 2 côtés (domicile + extérieur) avec
//   difficulté officielle côté domicile, dérivée côté extérieur
// - Journée courante stockée dans SyncState
// ═══════════════════════════════════════════════════════════════
import { db } from '@/lib/db'

export interface SyncResult {
  playersUpdated: number
  playersCreated: number
  sourcedEnriched: number
  fixturesWritten: number
  currentRound: number
  at: string
  durationMs: number
}

interface FplElement {
  id: number
  web_name: string
  first_name: string
  second_name: string
  element_type: number // 1 GK 2 DEF 3 MID 4 FWD
  team: number
  now_cost: number // prix ×10 (£M)
  selected_by_percent: string
  form: string
  total_points: number
  minutes: number
  goals_scored: number
  assists: number
  expected_goals: string
  expected_assists: string
  ep_next: string
  status: string // a d i u
  news: string | null
}
interface FplTeam { id: number; name: string; short_name: string; strength: number }
interface FplEvent { id: number; is_next: boolean; is_current: boolean; name: string }
interface FplFixture {
  event: number | null
  team_h: number
  team_a: number
  kickoff_time: string | null
  finished: boolean
  difficulty: number | null // officielle, pour l'équipe à domicile
}

const POS: Record<number, string> = { 1: 'G', 2: 'D', 3: 'M', 4: 'A' }
const STATUS: Record<string, string> = { a: 'DISPO', d: 'DOUTEUX', i: 'ABSENT', u: 'ABSENT' }

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '')

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Difficulté dérivée des forces officielles FPL (1-5).
 * L'API ne fournit la difficulté officielle que pour les matchs proches ;
 * pour les journées lointaines on la calcule depuis la force du club adverse
 * (léger avantage du terrain pour le club à domicile).
 */
export function deriveDifficulty(opponentStrength: number, isHome: boolean): number {
  return clamp(Math.round(opponentStrength + (isHome ? -0.5 : 0.5)), 1, 5)
}

export async function runSync(): Promise<SyncResult> {
  const t0 = Date.now()

  const [boot, fixtures] = await Promise.all([
    fetch('https://fantasy.premierleague.com/api/bootstrap-static/', { cache: 'no-store' }).then((r) => r.json()),
    fetch('https://fantasy.premierleague.com/api/fixtures/', { cache: 'no-store' }).then((r) => r.json()),
  ])

  const elements: FplElement[] = boot.elements
  const teams: FplTeam[] = boot.teams
  const events: FplEvent[] = boot.events
  const teamName = new Map<number, string>(teams.map((t) => [t.id, t.name]))
  const teamStrength = new Map<number, number>(teams.map((t) => [t.id, t.strength]))

  // Journée courante : prochaine event officielle (ou courante si matches en cours)
  const currentRound =
    events.find((e) => e.is_next)?.id ?? events.find((e) => e.is_current)?.id ?? 1

  // ── Joueurs ──────────────────────────────────────────────────
  const existing = await db.player.findMany()
  const byFplId = new Map<number, string>(existing.filter((p) => p.fplId != null).map((p) => [p.fplId!, p.id]))
  const byKey = new Map<string, string>()
  for (const p of existing) {
    byKey.set(norm(p.name), p.id)
    const parts = p.name.split(/\s+/)
    if (parts.length > 1) byKey.set(norm(parts[parts.length - 1]), p.id)
  }

  let playersUpdated = 0
  let playersCreated = 0
  let sourcedEnriched = 0

  // stats à écrire (prix/ownership Sofascore des 24 sourcés préservés : non inclus)
  const buildData = (e: FplElement) => ({
    club: teamName.get(e.team) ?? 'Inconnu',
    position: POS[e.element_type] ?? 'M',
    status: STATUS[e.status] ?? 'DISPO',
    news: e.news || null,
    form: e.form ? parseFloat(e.form) : null,
    totalPoints: e.total_points,
    minutes: e.minutes,
    goals: e.goals_scored,
    assists: e.assists,
    xg: e.expected_goals ? parseFloat(e.expected_goals) : null,
    xa: e.expected_assists ? parseFloat(e.expected_assists) : null,
    epNext: e.ep_next ? parseFloat(e.ep_next) : null,
    priceRef: e.now_cost / 10,
    ownershipRef: e.selected_by_percent ? parseFloat(e.selected_by_percent) : null,
    fplId: e.id,
    source: 'FPL',
  })

  const upsertOne = async (e: FplElement) => {
    const data = buildData(e)
    const foundId =
      byFplId.get(e.id) ??
      byKey.get(norm(`${e.first_name} ${e.second_name}`)) ??
      byKey.get(norm(e.web_name)) ??
      byKey.get(norm(e.second_name))

    if (foundId) {
      const prev = existing.find((p) => p.id === foundId)!
      if (prev.source && prev.source !== 'FPL') sourcedEnriched++
      await db.player.update({ where: { id: foundId }, data: { ...data, name: prev.name } })
      playersUpdated++
    } else {
      await db.player.create({ data: { ...data, name: e.web_name } })
      playersCreated++
    }
  }

  const CHUNK = 40
  for (let i = 0; i < elements.length; i += CHUNK) {
    await Promise.all(elements.slice(i, i + CHUNK).map(upsertOne))
  }

  // ── Calendrier : les DEUX côtés de chaque match ─────────────
  await db.fixture.deleteMany({})
  const rows = fixtures
    .filter((f: FplFixture) => f.event !== null && teamName.has(f.team_h) && teamName.has(f.team_a))
    .flatMap((f: FplFixture) => {
      const home = teamName.get(f.team_h)!
      const away = teamName.get(f.team_a)!
      const homeDiff = f.difficulty ?? deriveDifficulty(teamStrength.get(f.team_a) ?? 3, true)
      const aDiff = deriveDifficulty(teamStrength.get(f.team_h) ?? 3, false)
      return [
        {
          round: f.event!, club: home, opponent: away, isHome: true,
          kickoff: f.kickoff_time, difficulty: homeDiff, source: 'FPL',
        },
        {
          round: f.event!, club: away, opponent: home, isHome: false,
          kickoff: f.kickoff_time, difficulty: aDiff, source: 'FPL',
        },
      ]
    })
  for (let i = 0; i < rows.length; i += 300) {
    await db.fixture.createMany({ data: rows.slice(i, i + 300) })
  }

  // ── État de sync ─────────────────────────────────────────────
  const at = new Date().toISOString()
  await db.syncState.upsert({
    where: { key: 'currentRound' },
    update: { value: String(currentRound) },
    create: { key: 'currentRound', value: String(currentRound) },
  })
  await db.syncState.upsert({
    where: { key: 'lastSync' },
    update: { value: at, at },
    create: { key: 'lastSync', value: at, at },
  })
  await db.dataEvent.create({
    data: {
      at,
      kind: 'SAISON',
      title: `Sync API officielle — J${currentRound}`,
      detail: `${playersUpdated + playersCreated} joueurs, ${rows.length} lignes calendrier (domicile + extérieur)`,
    },
  })

  return {
    playersUpdated,
    playersCreated,
    sourcedEnriched,
    fixturesWritten: rows.length,
    currentRound,
    at,
    durationMs: Date.now() - t0,
  }
}

/** Date du dernier sync (null si jamais exécuté). */
export async function getLastSync(): Promise<{ at: string; currentRound: number | null } | null> {
  const [last, round] = await Promise.all([
    db.syncState.findUnique({ where: { key: 'lastSync' } }),
    db.syncState.findUnique({ where: { key: 'currentRound' } }),
  ])
  if (!last) return null
  return { at: last.at ?? last.value, currentRound: round ? parseInt(round.value) : null }
}
