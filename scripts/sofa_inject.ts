/**
 * INJECTION SOFASCORE RÉEL — VERSION BULK (INSERT ... ON CONFLICT)
 * 4 requêtes SQL géantes au lieu de 900 appels réseau.
 */
import { readFileSync } from 'fs'
import { randomBytes } from 'crypto'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const cuid = () => 'c' + randomBytes(12).toString('hex')

const CLUB: Record<string, string> = {
  arsenal: 'Arsenal', 'aston-villa': 'Aston Villa', bournemouth: 'Bournemouth',
  brentford: 'Brentford', 'brighton-and-hove-albion': 'Brighton', burnley: 'Burnley',
  chelsea: 'Chelsea', 'crystal-palace': 'Crystal Palace', everton: 'Everton',
  fulham: 'Fulham', 'hull-city': 'Hull City', 'ipswich-town': 'Ipswich Town',
  'leeds-united': 'Leeds', 'liverpool-fc': 'Liverpool', liverpool: 'Liverpool',
  'manchester-city': 'Man City', 'manchester-united': 'Man Utd', 'newcastle-united': 'Newcastle',
  'nottingham-forest': "Nott'm Forest", sunderland: 'Sunderland', 'tottenham-hotspur': 'Spurs',
  'coventry-city': 'Coventry City',
}
const clubOf = (slug: string | null | undefined) => (slug ? CLUB[slug] ?? slug : 'Inconnu')
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '')

type Row = (string | number | boolean | null)[]
const CAST: Record<string, string> = {
  isHome: 'boolean', round: 'int', difficulty: 'int', homeGoals: 'int', awayGoals: 'int',
  kickoff: 'timestamptz', played: 'int', wins: 'int', draws: 'int', losses: 'int',
  gf: 'int', ga: 'int', points: 'int', position: 'int', sofascoreId: 'bigint',
  marketValue: 'bigint', jersey: 'int', userCount: 'bigint', status: 'text',
}
function buildBulk(table: string, cols: string[], conflictCols: string[], updateCols: string[], rows: Row[]) {
  const params: Row = []
  const chunks: string[] = []
  const ph = (i: number, j: number) => `$${i * cols.length + j + 1}${CAST[cols[j]] ? '::' + CAST[cols[j]] : ''}`
  rows.forEach((r, i) => {
    params.push(...r)
    chunks.push(`(${cols.map((_, j) => ph(i, j)).join(',')})`)
  })
  const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES ${chunks.join(',')}
    ON CONFLICT (${conflictCols.map((c) => `"${c}"`).join(',')}) DO UPDATE SET ${updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(',')}`
  return { sql, params }
}

async function main() {
  const t0 = Date.now()
  const data = JSON.parse(readFileSync('/home/z/my-project/scripts/sofa_data.json', 'utf8'))
  const teams: any[] = data.teams
  const squads: Record<string, { players: any[]; manager?: string; venue?: string }> = data.squads
  const events: any[] = data.events
  const scrapedAt = data.scrapedAt
  console.log(`Données: ${teams.length} équipes, ${Object.values(squads).reduce((a: number, s: any) => a + s.players.length, 0)} joueurs, ${events.length} matchs`)

  // ── 1) Classement ──────────────────────────────────────────
  const stRows: Row[] = teams.map((t) => [
    cuid(), clubOf(t.slug), t.sofascoreId, t.slug, t.shortName, t.position, t.matches, t.wins, t.draws,
    t.losses, t.scoresFor, t.scoresAgainst, t.points, squads[t.slug]?.manager ?? null,
    squads[t.slug]?.venue ?? null, scrapedAt,
  ])
  const st = buildBulk('TeamStanding',
    ['id', 'club', 'sofascoreId', 'slug', 'shortName', 'position', 'played', 'wins', 'draws', 'losses', 'gf', 'ga', 'points', 'coach', 'venue', 'updatedAt'],
    ['club'], ['sofascoreId', 'slug', 'shortName', 'position', 'played', 'wins', 'draws', 'losses', 'gf', 'ga', 'points', 'coach', 'venue', 'updatedAt'],
    stRows)
  await db.$executeRawUnsafe(st.sql, ...st.params)
  console.log('ETAPE1 OK TeamStanding')
  console.log(`✅ TeamStanding: ${stRows.length} clubs`)

  // ── 2) Joueurs ─────────────────────────────────────────────
  const existing = await db.player.findMany({ select: { id: true, name: true, club: true, sofascoreId: true } })
  const byNormNameClub = new Map<string, string>()
  const byNormName = new Map<string, string>()
  for (const p of existing) {
    byNormNameClub.set(`${norm(p.name)}|${norm(p.club)}`, p.id)
    byNormName.set(norm(p.name), p.id)
    const parts = p.name.split(/\s+/)
    if (parts.length > 1) byNormNameClub.set(`${norm(parts[parts.length - 1])}|${norm(p.club)}`, p.id)
  }

  type NewP = { name: string; club: string; position: string; sofascoreId: number; marketValue: number | null; jersey: number | null; country: string | null; userCount: number | null }
  const updates: { id: string; d: NewP }[] = []
  const creates: NewP[] = []
  const sofaLinked = new Map<number, string>()

  for (const [slug, sq] of Object.entries(squads)) {
    const club = clubOf(slug)
    for (const sp of sq.players) {
      if (!sp.sofascoreId || !sp.name) continue
      const pos = sp.position === 'F' ? 'A' : sp.position
      const d: NewP = {
        name: sp.name, club, position: pos, sofascoreId: sp.sofascoreId,
        marketValue: sp.marketValue ?? null, jersey: sp.jerseyNumber != null ? Number(sp.jerseyNumber) : null,
        country: sp.country ?? null, userCount: sp.userCount != null ? Number(sp.userCount) : null,
      }
      let id = byNormNameClub.get(`${norm(sp.name)}|${norm(club)}`) ?? byNormName.get(norm(sp.name))
      if (id) updates.push({ id, d })
      else creates.push(d)
      sofaLinked.set(sp.sofascoreId, id ?? '')
    }
  }

  // updates en batch SQL (UPDATE ... FROM VALUES avec casts explicites)
  if (updates.length) {
    const UF = [
      ['club', 'text'], ['position', 'text'], ['sofascoreId', 'bigint'], ['marketValue', 'bigint'],
      ['jersey', 'int'], ['country', 'text'], ['userCount', 'bigint'],
    ] as const
    for (let k = 0; k < updates.length; k += 100) {
      const pack = updates.slice(k, k + 100)
      const params: any[] = []
      const chunks: string[] = []
      pack.forEach((u) => {
        const vals = [u.id, u.d.club, u.d.position, u.d.sofascoreId, u.d.marketValue, u.d.jersey, u.d.country, u.d.userCount]
        const ph = vals.map((v, j) => {
          params.push(v)
          const cast = j === 0 ? '::text' : j >= 3 && j <= 4 ? '::bigint' : j === 5 ? '::int' : j === 7 ? '::bigint' : '::text'
          return `$${params.length}${cast}`
        })
        chunks.push(`(${ph.join(',')})`)
      })
      await db.$executeRawUnsafe(
        `UPDATE "Player" AS p SET
           "club" = v.club, "position" = v.position, "sofascoreId" = v.sofascoreId,
           "marketValue" = v.marketValue, "jersey" = v.jersey, "country" = v.country,
           "userCount" = v.userCount, "source" = 'SOFA-SSR'
         FROM (VALUES ${chunks.join(',')}) AS v(id, club, position, sofascoreId, marketValue, jersey, country, userCount)
         WHERE p."id" = v.id`,
        ...params)
    }
  }
  if (creates.length) {
    const rows: Row[] = creates.map((d) => [cuid(), d.name, d.club, true, d.position, d.sofascoreId, d.marketValue, d.jersey, d.country, d.userCount, 'DISPO', 'SOFA-SSR'])
    const cols = ['id', 'name', 'club', 'clubConfirmed', 'position', 'sofascoreId', 'marketValue', 'jersey', 'country', 'userCount', 'status', 'source']
    const CASTP: Record<string, string> = { sofascoreId: 'bigint', marketValue: 'bigint', jersey: 'int', userCount: 'bigint' }
    for (let k = 0; k < rows.length; k += 150) {
      const params: Row = []
      const chunks: string[] = []
      rows.slice(k, k + 150).forEach((r, i) => {
        params.push(...r)
        chunks.push(`(${cols.map((_, j) => {
          const c = cols[j]
          return `$${i * cols.length + j + 1}${CASTP[c] ? '::' + CASTP[c] : ''}`
        }).join(',')})`)
      })
      await db.$executeRawUnsafe(`INSERT INTO "Player" (${cols.map((c) => `"${c}"`).join(',')}) VALUES ${chunks.join(', ')}
        ON CONFLICT ("sofascoreId") DO UPDATE SET "name" = EXCLUDED."name", "club" = EXCLUDED."club", "position" = EXCLUDED."position"`, ...params)
    }
  }
  console.log('ETAPE2 OK Players')
  console.log(`✅ Players: ${updates.length} mis à jour, ${creates.length} créés`)

  // ── 3) Fixtures ────────────────────────────────────────────
  const standings = new Map(teams.map((t) => [clubOf(t.slug), t.position]))
  const diffOf = (posOpp: number) => (posOpp <= 4 ? 5 : posOpp <= 8 ? 4 : posOpp <= 13 ? 3 : posOpp <= 17 ? 2 : 1)
  const fRows: Row[] = []
  for (const e of events) {
    if (!e.round || !e.homeTeam || !e.awayTeam) continue
    const home = clubOf(e.homeTeam)
    const away = clubOf(e.awayTeam)
    const kickoff = e.startTimestamp ? new Date(e.startTimestamp * 1000).toISOString() : null
    fRows.push([e.round, home, away, true, kickoff, diffOf(standings.get(away) ?? 10), 'SOFA-SSR', e.status, e.homeScore, e.awayScore, e.customId, scrapedAt])
    fRows.push([e.round, away, home, false, kickoff, diffOf(standings.get(home) ?? 10), 'SOFA-SSR', e.status, e.homeScore, e.awayScore, e.customId, scrapedAt])
  }
  const fCols = ['round', 'club', 'opponent', 'isHome', 'kickoff', 'difficulty', 'source', 'status', 'homeGoals', 'awayGoals', 'customId', 'updatedAt']
  const fRowsFull = fRows.map((r) => [cuid(), ...r])
  const fColsFull = ['id', ...fCols]
  for (let k = 0; k < fRowsFull.length; k += 120) {
    const params: Row = []
    const chunks: string[] = []
    fRowsFull.slice(k, k + 120).forEach((r, i) => {
      params.push(...r)
      chunks.push(`(${fColsFull.map((_, j) => {
        const c = fColsFull[j]
        return `$${i * fColsFull.length + j + 1}${CAST[c] ? '::' + CAST[c] : ''}`
      }).join(',')})`)
    })
    await db.$executeRawUnsafe(`INSERT INTO "Fixture" (${fColsFull.map((c) => `"${c}"`).join(',')}) VALUES ${chunks.join(', ')}
      ON CONFLICT (round, club) DO UPDATE SET
        "opponent" = EXCLUDED."opponent", "isHome" = EXCLUDED."isHome",
        "kickoff" = COALESCE(EXCLUDED."kickoff", "Fixture"."kickoff"),
        "difficulty" = EXCLUDED."difficulty",
        "status" = EXCLUDED."status", "homeGoals" = EXCLUDED."homeGoals", "awayGoals" = EXCLUDED."awayGoals",
        "customId" = EXCLUDED."customId", "updatedAt" = EXCLUDED."updatedAt"`, ...params)
  }
  console.log('ETAPE3 OK Fixtures')
  console.log(`✅ Fixtures: ${fRows.length} lignes réelles`)

  // ── 4) Buts/assists réels depuis incidents ─────────────────
  const goals = new Map<number, number>()
  const assists = new Map<number, number>()
  let played = 0
  for (const e of events) {
    if (e.status !== 'Ended') continue
    if (e.homeScore != null) played++
    for (const inc of e.incidents ?? []) {
      if (inc.type === 'goal') {
        if (inc.playerId) goals.set(inc.playerId, (goals.get(inc.playerId) ?? 0) + 1)
        if (inc.assistId) assists.set(inc.assistId, (assists.get(inc.assistId) ?? 0) + 1)
      }
    }
  }
  // update par CASE sur sofascoreId
  const gArr = [...goals.entries()].filter(([sid]) => sofaLinked.has(sid))
  const aArr = [...assists.entries()].filter(([sid]) => sofaLinked.has(sid))
  for (const [arr, col] of [[gArr, 'goals'], [aArr, 'assists']] as const) {
    for (let k = 0; k < arr.length; k += 150) {
      const pack = arr.slice(k, k + 150)
      const params: any[] = pack.map(([sid]) => sid)
      const whens = pack.map(([sid, n], i) => `WHEN p."sofascoreId" = ${Number(sid)} THEN ${Number(n)}`).join(' ')
      await db.$executeRawUnsafe(`UPDATE "Player" AS p SET "${col}" = CASE ${whens} END
        WHERE p."sofascoreId" IN (${pack.map((_, i) => `$${i + 1}`).join(',')})`, ...params)
    }
  }
  console.log('ETAPE4 OK Stats')
  console.log(`✅ Stats réelles: ${gArr.length} buteurs, ${aArr.length} passeurs (${played} matchs joués)`)

  // ── 5) Journée courante ────────────────────────────────────
  // currentRound = round du prochain match à venir PAR KICKOFF (les reports ne bloquent pas)
  const nextByKickoff = events
    .filter((e) => e.round && e.status === 'Not started' && e.startTimestamp && e.startTimestamp * 1000 > Date.now())
    .sort((a, b) => (a.startTimestamp! - b.startTimestamp!))[0]
  const currentRound = nextByKickoff?.round ?? 5
  await db.$executeRawUnsafe(`UPDATE "SyncState" SET "value" = $1, "at" = $2 WHERE key = 'currentRound'`, String(currentRound), scrapedAt)
  await db.$executeRawUnsafe(`UPDATE "SyncState" SET "value" = $1, "at" = $2 WHERE key = 'lastSync'`, scrapedAt, scrapedAt)
  await db.dataEvent.create({
    data: {
      at: scrapedAt, kind: 'SAISON', title: 'Sync Sofascore SSR complète',
      detail: `${teams.length} équipes, ${updates.length + creates.length} joueurs (valeurs marché réelles), ${played} matchs joués (buts/assists réels via incidents), ${events.length} matchs. Source: SSR sofascore.com.`,
    },
  })
  console.log(`🏁 Terminé en ${((Date.now() - t0) / 1000).toFixed(0)}s — currentRound=J${currentRound}`)
}

main()
  .catch((e) => { console.error('ERREUR:', e); process.exitCode = 1 })
  .finally(() => db.$disconnect())
