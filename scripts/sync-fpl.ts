/**
 * SYNC — base joueurs COMPLÈTE de Premier League + calendrier saison
 *
 * Source : API officielle FPL (fantasy.premierleague.com) — accès public, réel.
 * Les 24 joueurs déjà sourcés Sofascore (prix €/ownership) sont conservés et
 * enrichis ; les ~640 autres sont créés avec les stats réelles + prix de référence.
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

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
  clean_sheets: number
  expected_goals: string
  expected_assists: string
  ep_next: string
  status: string // a d i u
  news: string | null
  chance_of_playing_this_round: number | null
}
interface FplTeam { id: number; name: string; short_name: string }
interface FplFixture {
  event: number | null
  team_h: number
  team_a: number
  kickoff_time: string | null
  finished: boolean
}

const POS: Record<number, string> = { 1: 'G', 2: 'D', 3: 'M', 4: 'A' }
const STATUS: Record<string, string> = { a: 'DISPO', d: 'DOUTEUX', i: 'ABSENT', u: 'ABSENT' }

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '')

async function main() {
  const boot = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/').then((r) => r.json())
  const fixtures: FplFixture[] = await fetch('https://fantasy.premierleague.com/api/fixtures/').then((r) => r.json())
  const elements: FplElement[] = boot.elements
  const teams: FplTeam[] = boot.teams
  const teamName = new Map<number, string>(teams.map((t) => [t.id, t.name]))

  // joueurs existants (sourcés Sofascore) pour fusion
  const existing = await db.player.findMany()
  const byKey = new Map<string, string>() // clé normalisée → id
  for (const p of existing) {
    const tokens = norm(p.name)
    byKey.set(tokens, p.id)
    // clé par dernier token (nom de famille)
    const parts = p.name.split(/\s+/)
    if (parts.length > 1) byKey.set(norm(parts[parts.length - 1]), p.id)
  }

  let updated = 0
  let created = 0
  let matchedSourced = 0
  const unmatchedSourced: string[] = []

  for (const e of elements) {
    const club = teamName.get(e.team) ?? 'Inconnu'
    const full = `${e.first_name} ${e.second_name}`.trim()
    // nom affiché : web_name s'il est distinctif, sinon nom complet
    const display =
      e.web_name.length >= 3 && norm(e.web_name) !== norm(e.second_name)
        ? e.web_name
        : e.second_name
        ? e.second_name
        : full
    const displayName = e.web_name.includes(' ') || norm(e.web_name) === norm(e.second_name) ? e.web_name : display

    const existingId =
      byKey.get(norm(full)) ?? byKey.get(norm(displayName)) ?? byKey.get(norm(e.web_name)) ?? byKey.get(norm(e.second_name))

    const data = {
      name: e.web_name.includes(' ') ? e.web_name : displayName === full ? full : displayName,
      club,
      position: POS[e.element_type],
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
      source: 'FPL',
    }

    if (existingId) {
      const prev = existing.find((p) => p.id === existingId)!
      if (prev.source && prev.source !== 'FPL') matchedSourced++
      await db.player.update({ where: { id: existingId }, data })
      updated++
    } else {
      await db.player.create({ data: { ...data, name: e.web_name.includes(' ') ? e.web_name : full } })
      created++
    }
  }

  // vérifier que les 24 sourcés ont bien été retrouvés
  for (const p of existing.filter((x) => x.source && x.source !== 'FPL')) {
    const tokens = p.name.split(/\s+/)
    const found = elements.some(
      (e) => norm(e.second_name) === norm(tokens[tokens.length - 1]) || norm(`${e.first_name} ${e.second_name}`) === norm(p.name),
    )
    if (!found) unmatchedSourced.push(p.name)
  }

  // Fixtures : remplacer l'ancien jeu (article) par la saison complète
  await db.fixture.deleteMany({})
  const fixtureRows = fixtures
    .filter((f) => f.event !== null)
    .map((f) => ({
      round: f.event!,
      club: teamName.get(f.team_h)!,
      opponent: teamName.get(f.team_a)!,
      isHome: true,
      kickoff: f.kickoff_time,
      source: 'FPL',
    }))
  await db.fixture.createMany({ data: fixtureRows })

  console.log(`Joueurs : ${updated} mis à jour (dont ${matchedSourced} sourcés Sofascore enrichis), ${created} créés`)
  console.log(`Fixtures : ${fixtureRows.length} matches saison complète`)
  if (unmatchedSourced.length) console.log('⚠️ sourcés non retrouvés dans FPL :', unmatchedSourced)
  else console.log('✓ tous les joueurs sourcés Sofascore ont été retrouvés et enrichis')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
