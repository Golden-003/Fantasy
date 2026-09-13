// ─── Moteur coach v2 — 100% données réelles (API officielle Fantasy Premier League) ───
// Aucune donnée inventée : tout est calculé depuis bootstrap-static, fixtures, live,
// entry (mon équipe réelle) et leagues-classic (ma vraie ligue privée).

import { db } from '@/lib/db'
import * as fpl from '@/lib/fpl/client'
import type {
  AlertItem, BuyCandidate, FixtureChip, LeagueData, LiveNow, MyTeamOverview, PlayerRow,
  PlayerStatus, Position, RivalAnalysis, SellCandidate, SquadEntry, TeamFixtureRow,
  TransferPlan, Verdict,
} from './types'

const POS_MAP: Record<number, Position> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const num = (s: string | number | null | undefined) => parseFloat(String(s ?? '')) || 0
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const r1 = (v: number) => Math.round(v * 10) / 10
const FIX_WINDOW = 5

export const NEED_SETUP = 'NEED_SETUP'
export const verdictEmoji = (v: Verdict) => (v === 'GREEN' ? '🟢' : v === 'YELLOW' ? '🟡' : '🔴')

export interface CoachSettings { teamId: number | null; leagueId: number | null; cookie: string | null }

export async function getSettings(): Promise<CoachSettings> {
  try {
    const s = await db.settings.findUnique({ where: { id: 'default' } })
    return { teamId: s?.teamId ?? null, leagueId: s?.leagueId ?? null, cookie: s?.cookie ?? null }
  } catch {
    return { teamId: null, leagueId: null, cookie: null }
  }
}

// ─── Contexte de saison (réel) ───────────────────────────────────────────────

interface Ctx {
  teams: Map<number, fpl.FplTeam>
  elements: fpl.FplElement[]
  gwsFinished: number[]
  gwsPlayed: number
  currentGw: number | null
  focusGw: number
  seasonLabel: string
  pastOpp: Map<string, { opp: number; venue: 'H' | 'A' }> // `${gw}:${teamId}`
  upcomingByTeam: Map<number, fpl.FplFixture[]>
  fixtures: fpl.FplFixture[]
}

async function buildCtx(): Promise<Ctx> {
  const boot = await fpl.getBootstrap()
  const fixtures = await fpl.getFixtures()
  const events = boot.events
  const gwsFinished = events.filter((e) => e.finished).map((e) => e.id)
  const current = events.find((e) => e.is_current && !e.finished)
  const next = events.find((e) => e.is_next)
  const focusGw = next?.id ?? current?.id ?? (gwsFinished.at(-1) ?? 0) + 1
  const teams = new Map(boot.teams.map((t) => [t.id, t]))

  const pastOpp = new Map<string, { opp: number; venue: 'H' | 'A' }>()
  for (const f of fixtures) {
    if (f.event == null || !f.finished) continue
    pastOpp.set(`${f.event}:${f.team_h}`, { opp: f.team_a, venue: 'H' })
    pastOpp.set(`${f.event}:${f.team_a}`, { opp: f.team_h, venue: 'A' })
  }
  const upcomingByTeam = new Map<number, fpl.FplFixture[]>()
  for (const f of fixtures) {
    if (f.event == null || f.event < focusGw) continue
    for (const tid of [f.team_h, f.team_a]) {
      const arr = upcomingByTeam.get(tid) ?? []
      arr.push(f)
      upcomingByTeam.set(tid, arr)
    }
  }
  for (const arr of upcomingByTeam.values()) arr.sort((a, b) => (a.event ?? 0) - (b.event ?? 0))

  const y0 = new Date(events[0]?.deadline_time ?? Date.now()).getFullYear()
  const seasonLabel = `Premier League ${y0}/${String((y0 + 1) % 100).padStart(2, '0')}`

  return {
    teams, elements: boot.elements, gwsFinished, gwsPlayed: gwsFinished.length,
    currentGw: current?.id ?? null, focusGw, seasonLabel, pastOpp, upcomingByTeam, fixtures,
  }
}

// Live réel par journée → map playerId → stats
async function liveMap(gw: number, isCurrent: boolean) {
  const live = await fpl.getLive(gw, isCurrent)
  return new Map(live.elements.map((e) => [e.id, e.stats]))
}

async function picksFor(teamId: number, gw: number): Promise<fpl.FplPicks> {
  for (const g of [gw, gw - 1, gw - 2]) {
    if (g < 1) break
    try { return await fpl.getEntryPicks(teamId, g) } catch { /* journée pas encore définie */ }
  }
  throw new Error('PICKS_UNAVAILABLE')
}

// ─── Construction des PlayerRow (joueurs réels) ──────────────────────────────

const STATUS_MAP: Record<string, PlayerStatus> = { a: 'FIT', d: 'DOUBTFUL', i: 'INJURED', s: 'SUSPENDED', u: 'INJURED', n: 'FIT' }

function availability(el: fpl.FplElement): number {
  const chanceNext = el.chance_of_playing_next_round
  switch (el.status) {
    case 'a': return 1
    case 'd': return clamp((el.chance_of_playing_this_round ?? 75) / 100, 0.15, 0.9)
    case 'i': case 's': case 'u': return (chanceNext ?? 0) >= 75 ? 0.55 : 0.05
    default: return 0.8
  }
}

interface RowsOpts { ownership?: Map<number, string[]>; myIds?: Set<number> }

function buildRows(ctx: Ctx, opts: RowsOpts) {
  const lastGws = ctx.gwsFinished.slice(-5)
  const livePromises = lastGws.map((gw) => liveMap(gw, ctx.currentGw === gw))
  return Promise.all(livePromises).then((liveByGw) => {
    const rows: PlayerRow[] = []
    for (const el of ctx.elements) {
      if (el.removed || el.special) continue
      const team = ctx.teams.get(el.team)
      if (!team) continue
      const position = POS_MAP[el.element_type]
      const status = STATUS_MAP[el.status] ?? 'FIT'
      const gwp = Math.max(1, ctx.gwsPlayed)
      const minutesPct = clamp(Math.round((el.minutes / (gwp * 90)) * 100), 0, 100)
      const expectedMinutes = clamp(el.minutes / (gwp * 90), 0, 1)
      const formN = num(el.form)
      const ppg = num(el.points_per_game)
      const A = availability(el)

      // 5 derniers matchs réels (live FPL : minutes, buts, passes, BPS)
      const last5: Last5Match[] = []
      let apps = 0
      for (let i = 0; i < lastGws.length; i++) {
        const gw = lastGws[i]
        const st = liveByGw[i]?.get(el.id)
        const opp = ctx.pastOpp.get(`${gw}:${el.team}`)
        if (!st || !opp) continue
        if (st.minutes === 0 && st.bps === 0) continue
        if (st.minutes > 0) apps++
        last5.push({
          gw,
          oppShort: ctx.teams.get(opp.opp)?.short_name ?? '?',
          venue: opp.venue,
          rating: r1(clamp(4 + st.bps / 10, 4, 10)),
          minutes: st.minutes, goals: st.goals_scored, assists: st.assists,
        })
      }

      // Calendrier réel à venir (5 journées, doubles journées gérées)
      const fixtures: FixtureChip[] = []
      const upc = ctx.upcomingByTeam.get(el.team) ?? []
      for (const f of upc) {
        if (fixtures.length >= FIX_WINDOW + 2) break
        const home = f.team_h === el.team
        const opp = ctx.teams.get(home ? f.team_a : f.team_h)
        if (!opp || f.event == null) continue
        fixtures.push({ gw: f.event, opp: opp.short_name, venue: home ? 'H' : 'A', difficulty: home ? f.team_h_difficulty : f.team_a_difficulty })
      }
      const diffs = fixtures.slice(0, FIX_WINDOW).map((f) => f.difficulty)
      const avgDiff = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 3
      const fixtureScore = clamp(Math.round(((6 - avgDiff) / 5) * 100), 0, 100)

      // Projection J+1 (explicable, calée sur ep_next officiel + forme + minutes + calendrier)
      const epNext = num(el.ep_next)
      const base = 0.45 * epNext + 0.35 * formN + 0.2 * ppg
      const fx3 = (fixtures.slice(0, 3).map((f) => f.difficulty).reduce((a, b) => a + b, 0) / Math.max(1, fixtures.slice(0, 3).length)) || 3
      const F = 1 + (3 - fx3) * 0.09
      const M = clamp(expectedMinutes, 0.25, 1)
      const projection = r1(base * M * F * A)

      // Cumul 5 journées
      let p5 = 0
      for (const f of fixtures.slice(0, FIX_WINDOW)) {
        p5 += base * M * (1 + (3 - f.difficulty) * 0.09) * A
      }
      const projection5 = r1(p5)

      // Verdict 🟢🟡🔴 avec raisons réelles
      const reasons: string[] = []
      let red = false, green = false
      if (A < 0.5) {
        red = true
        reasons.push(`Très incertain pour J${ctx.focusGw} — ${el.news || 'statut ' + el.status.toUpperCase()}`)
      } else if (status === 'DOUBTFUL') {
        reasons.push(`Incertitude physique : ${el.chance_of_playing_this_round ?? 75}% de jouer — ${el.news || 'suivi de l’effectif'}`)
      }
      if (projection >= 6.2) {
        green = true
        reasons.push(`Projection ${fmtN(projection)} pts pour J${ctx.focusGw} (forme ${fmtN(formN)}, ép_next officiel ${fmtN(epNext)})`)
      }
      if (formN >= 5 && fixtureScore >= 60) {
        green = true
        reasons.push(`Forme chaude (${fmtN(formN)} pts) et calendrier favorable (${fixtureScore}/100)`)
      }
      if (minutesPct < 40 && A > 0.5) {
        red = true
        reasons.push(`Temps de jeu limité : ${el.minutes} min sur ${ctx.gwsPlayed} journées (${minutesPct}%)`)
      }
      if (formN < 2.8 && projection < 3.5 && A > 0.5) {
        red = true
        reasons.push(`Forme critique (${fmtN(formN)}) et faible projection (${fmtN(projection)})`)
      }
      if (reasons.length === 0) {
        reasons.push(`Rendement moyen : forme ${fmtN(formN)}, proj. ${fmtN(projection)}, calendrier ${fixtureScore}/100`)
      }
      const verdict: Verdict = red ? 'RED' : green ? 'GREEN' : 'YELLOW'

      const startShare = el.starts / gwp
      const rotationRisk = ctx.gwsPlayed === 0 ? 'MEDIUM' : startShare < 0.45 ? 'HIGH' : startShare < 0.75 ? 'MEDIUM' : 'LOW'
      let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE'
      if (el.cost_change_event > 0 || formN > ppg + 0.5) trend = 'UP'
      else if (el.cost_change_event < 0 || formN < ppg - 0.5) trend = 'DOWN'

      const ownedRivals = opts.ownership?.get(el.id) ?? []
      const injuryNote = el.news && status !== 'FIT' ? el.news : status === 'DOUBTFUL' ? el.news || 'Incertitude physique' : null

      rows.push({
        id: String(el.id), fplId: el.id, name: el.web_name,
        teamId: String(el.team), teamShort: team.short_name, teamName: team.name,
        position, price: el.now_cost / 10,
        ownership: num(el.selected_by_percent),
        status, injuryNote, rotationRisk, trend,
        rating: r1(ppg), form: r1(formN),
        minutesPct, expectedMinutes, epNext,
        stats: {
          apps: Math.max(apps, el.starts), minutes: el.minutes, starts: el.starts,
          goals: el.goals_scored, assists: el.assists,
          xg: num(el.expected_goals), xa: num(el.expected_assists), xgi: num(el.expected_goal_involvements),
          cleanSheets: el.clean_sheets, saves: el.saves, bonus: el.bonus, bps: el.bps,
          tackles: el.tackles, cbi: el.clearances_blocks_interceptions, recoveries: el.recoveries,
          yellow: el.yellow_cards, red: el.red_cards,
        },
        last5, fixtures, fixtureScore, projection, projection5, verdict, reasons,
        ownedByMe: opts.myIds?.has(el.id) ?? false, ownedByRivals: ownedRivals,
      })
    }
    return rows
  })
}
type Last5Match = PlayerRow['last5'][number]
const fmtN = (v: number) => v.toFixed(1).replace('.', ',')

// ─── Métriques de squad (moi + rivaux) ───────────────────────────────────────

interface SquadMetrics {
  starters: SquadEntry[]
  bench: SquadEntry[]
  projected: number
  squadScore: number
  captainName: string | null
  overlapIds: Set<number>
}

function squadMetrics(rowsById: Map<number, PlayerRow>, picks: fpl.FplPicks): SquadMetrics {
  const entries: SquadEntry[] = picks.picks.map((p) => ({
    slot: p.position,
    isStarter: p.position <= 11,
    isCaptain: p.is_captain,
    player: rowsById.get(p.element) ?? fallbackRow(p.element),
  }))
  const starters = entries.filter((e) => e.isStarter).sort((a, b) => a.slot - b.slot)
  const bench = entries.filter((e) => !e.isStarter).sort((a, b) => a.slot - b.slot)
  const proj = (e: SquadEntry) => (e.player.status === 'FIT' || e.player.status === 'DOUBTFUL' ? e.player.projection : 0)
  let projected = starters.reduce((acc, e) => acc + proj(e), 0)
  const cap = starters.find((e) => e.isCaptain)
  if (cap) { projected += proj(cap); }
  const captainName = cap?.player.name ?? null
  const avg = starters.length ? starters.reduce((acc, e) => acc + proj(e), 0) / starters.length : 0
  const squadScore = clamp(Math.round(((avg - 2.5) / 5) * 100), 1, 99)
  const overlapIds = new Set(entries.map((e) => e.player.fplId))
  return { starters, bench, projected: Math.round(projected * 10) / 10, squadScore, captainName, overlapIds }
}

const fallbackRow = (fplId: number): PlayerRow => ({
  id: String(fplId), fplId, name: `Joueur #${fplId}`, teamId: '0', teamShort: '?', teamName: '?',
  position: 'MID', price: 0, ownership: 0, status: 'FIT', injuryNote: null, rotationRisk: 'MEDIUM',
  trend: 'STABLE', rating: 0, form: 0, minutesPct: 0, expectedMinutes: 0, epNext: 0,
  stats: { apps: 0, minutes: 0, starts: 0, goals: 0, assists: 0, xg: 0, xa: 0, xgi: 0, cleanSheets: 0, saves: 0, bonus: 0, bps: 0, tackles: 0, cbi: 0, recoveries: 0, yellow: 0, red: 0 },
  last5: [], fixtures: [], fixtureScore: 50, projection: 0, projection5: 0, verdict: 'YELLOW',
  reasons: [], ownedByMe: false, ownedByRivals: [],
})

// ─── Mon équipe réelle ───────────────────────────────────────────────────────

function estimateFreeTransfers(history: fpl.FplEntryHistory): number {
  let ft = 1
  const evs = history.current.filter((e) => e.event >= 2).sort((a, b) => a.event - b.event)
  for (const e of evs) ft = Math.min(2, Math.max(0, ft - e.event_transfers) + 1)
  return ft
}

async function buildMyTeam(ctx: Ctx, settings: CoachSettings, rowsById: Map<number, PlayerRow>, myPicks: fpl.FplPicks, entry: fpl.FplEntry, history: fpl.FplEntryHistory): Promise<MyTeamOverview> {
  const m = squadMetrics(rowsById, myPicks)
  const eh = myPicks.entry_history
  const lastHist = history.current.at(-1)
  const bank = (eh?.bank ?? lastHist?.bank ?? 0) / 10
  const teamValue = (eh?.value ?? lastHist?.value ?? 1000) / 10

  // Transferts restants : exact si cookie valide, sinon estimation depuis l'historique réel
  let transfersLeft = estimateFreeTransfers(history)
  let transfersExact = false
  if (settings.cookie) {
    try {
      const mt = await fpl.getMyTeam(settings.teamId!, settings.cookie)
      if (mt?.transfers) {
        transfersLeft = Math.max(0, (mt.transfers.limit ?? 1) - (mt.transfers.made ?? 0))
        transfersExact = true
      }
    } catch { /* cookie expiré → estimation */ }
  }

  // Capitaine suggéré = meilleure projection du XI réel
  const best = [...m.starters].filter((e) => e.player.projection > 0).sort((a, b) => b.player.projection - a.player.projection)[0]
  const captainSuggestion = best && best.player.name !== m.captainName ? { name: best.player.name, projection: best.player.projection } : null

  const weakestStarters = [...m.starters]
    .filter((e) => e.player.projection < 5.2 || e.player.status === 'INJURED' || e.player.status === 'SUSPENDED')
    .sort((a, b) => a.player.projection - b.player.projection)
    .slice(0, 3)
    .map((e) => ({ name: e.player.name, projection: e.player.projection, verdict: e.player.verdict, reason: e.player.reasons[0] ?? 'Projection faible' }))

  return {
    teamName: entry.name, ownerName: `${entry.player_first_name} ${entry.player_last_name}`.trim(),
    bank: r1(bank), transfersLeft, transfersExact, totalPoints: entry.summary_overall_points ?? lastHist?.total_points ?? 0,
    rank: 0, leagueSize: 5, squadScore: m.squadScore, teamValue: r1(teamValue),
    starters: m.starters, bench: m.bench, captainSuggestion,
    projectedGwPoints: Math.round(m.projected), weakestStarters,
  }
}

// ─── Plan de transferts ──────────────────────────────────────────────────────

function buildTransfers(ctx: Ctx, rows: PlayerRow[], me: MyTeamOverview, myPicks: fpl.FplPicks): TransferPlan {
  const myIds = new Set(myPicks.picks.map((p) => p.element))
  const owned = rows.filter((r) => myIds.has(r.fplId))
  const pool = rows.filter((r) => !myIds.has(r.fplId) && r.price > 0)

  const flagReason = (p: PlayerRow): string | null => {
    if (p.status === 'INJURED' || p.status === 'SUSPENDED') return `${p.injuryNote ?? 'Indisponible'} — absent pour J${ctx.focusGw}`
    if (p.status === 'DOUBTFUL') return `Incertitude physique (${p.injuryNote ?? 'suivi'})`
    if (p.minutesPct < 45) return `Temps de jeu insuffisant (${p.minutesPct}% des minutes)`
    if (p.form < 3.2) return `Forme faible (${fmtN(p.form)} pts de moyenne sur 5)`
    if (p.fixtureScore < 40) return `Calendrier des 5 prochaines journées difficile (${p.fixtureScore}/100)`
    if (p.projection < 4.2) return `Projection faible pour J${ctx.focusGw} (${fmtN(p.projection)})`
    return null
  }

  const sell: SellCandidate[] = owned
    .map((p) => ({ p, r: flagReason(p) }))
    .sort((a, b) => (a.r ? 0 : 1) - (b.r ? 0 : 1) || a.p.projection - b.p.projection)
    .slice(0, 3)
    .filter((x) => x.r)
    .map(({ p, r }) => ({ player: p, reason: r! }))

  const buy: BuyCandidate[] = []
  const seen = new Set<number>()
  for (const s of sell) {
    const budget = s.player.price + me.bank
    const cands = pool
      .filter((p) => p.position === s.player.position && p.price <= budget + 0.1 && !seen.has(p.fplId))
      .sort((a, b) => b.projection - a.projection)
      .slice(0, 2)
    for (const c of cands) {
      if (c.projection <= s.player.projection + 0.1) continue
      seen.add(c.fplId)
      buy.push({
        player: c, netGain: r1(c.projection - s.player.projection), comparedTo: s.player.name,
        affordable: true, differential: c.ownedByRivals.length === 0,
        justification: `Forme ${fmtN(c.form)} • proj. J${ctx.focusGw} ${fmtN(c.projection)} • calendrier ${c.fixtureScore}/100${c.ownedByRivals.length === 0 ? ' • 0 rival ne le possède' : ''}`,
      })
    }
  }
  // Cibles libres si banque déjà suffisante (pas de vente nécessaire)
  const freeBudget = me.bank + Math.min(...(sell.length ? sell.map((s) => s.player.price) : [4.5]))
  if (buy.length < 6) {
    const free = pool
      .filter((p) => p.price <= freeBudget && !seen.has(p.fplId) && p.projection >= 5.5)
      .sort((a, b) => b.projection - a.projection)
      .slice(0, 6 - buy.length)
    for (const c of free) {
      seen.add(c.fplId)
      buy.push({
        player: c, netGain: null, comparedTo: null, affordable: true, differential: c.ownedByRivals.length === 0,
        justification: `Amélioration directe : proj. ${fmtN(c.projection)} (forme ${fmtN(c.form)}, calendrier ${c.fixtureScore}/100)${c.ownedByRivals.length === 0 ? ' • 0 rival ne le possède' : ''}`,
      })
    }
  }
  return { bank: me.bank, transfersLeft: me.transfersLeft, sell, buy }
}

// ─── Alertes ─────────────────────────────────────────────────────────────────

function buildAlerts(ctx: Ctx, rows: PlayerRow[], me: MyTeamOverview, rivals: RivalAnalysis[]): AlertItem[] {
  const alerts: AlertItem[] = []
  const myIds = new Set([...me.starters, ...me.bench].map((e) => e.player.fplId))

  for (const p of rows.filter((r) => myIds.has(r.fplId))) {
    if (p.status === 'INJURED' || p.status === 'SUSPENDED') {
      alerts.push({ id: `RISK:${p.fplId}`, type: 'SQUAD_RISK', severity: 'danger', title: `${p.name} indisponible`, detail: `${p.injuryNote ?? 'Statut ' + p.status} — prévois un remplacement pour J${ctx.focusGw}.`, playerId: p.id })
    } else if (p.status === 'DOUBTFUL') {
      alerts.push({ id: `RISK:${p.fplId}`, type: 'SQUAD_RISK', severity: 'warning', title: `${p.name} incertain`, detail: p.injuryNote ?? 'Incertitude physique — surveille les news avant le deadline.', playerId: p.id })
    } else if (p.rotationRisk === 'HIGH' && p.minutesPct < 50) {
      alerts.push({ id: `ROT:${p.fplId}`, type: 'SQUAD_RISK', severity: 'warning', title: `Rotation : ${p.name}`, detail: `Seulement ${p.minutesPct}% des minutes cette saison — risque de banc élevé.`, playerId: p.id })
    } else if (p.price >= 8 && p.form < 3.5) {
      alerts.push({ id: `UNDER:${p.fplId}`, type: 'UNDERPERF', severity: 'warning', title: `${p.name} sous-performe`, detail: `${fmtN(p.price)}M pour une forme de ${fmtN(p.form)} — rentabilité insuffisante.`, playerId: p.id })
    }
  }

  const opportunities = rows
    .filter((p) => !p.ownedByMe && p.form >= 5.5 && p.price <= 7.5 && p.fixtureScore >= 60 && p.ownedByRivals.length <= 1 && p.projection >= 5)
    .sort((a, b) => b.projection - a.projection).slice(0, 3)
  for (const p of opportunities) {
    alerts.push({ id: `OPP:${p.fplId}`, type: 'OPPORTUNITY', severity: 'success', title: `Opportunité : ${p.name}`, detail: `${p.teamShort} • ${fmtN(p.price)}M • forme ${fmtN(p.form)} • calendrier ${p.fixtureScore}/100 • possédé par ${p.ownedByRivals.length} rival(s) dans ta ligue.`, playerId: p.id })
  }

  const threats = rivals
    .flatMap((r) => r.threats.map((t) => ({ rival: r.ownerName, t })))
    .filter((x) => x.t.projection >= 6)
    .sort((a, b) => b.t.projection - a.t.projection).slice(0, 2)
  for (const x of threats) {
    alerts.push({ id: `THREAT:${x.rival}:${x.t.name}`, type: 'RIVAL_THREAT', severity: 'info', title: `${x.rival} mise sur ${x.t.name}`, detail: `Projection ${fmtN(x.t.projection)} pts pour J${ctx.focusGw} — ce joueur n'est pas dans ton équipe.`, playerId: undefined })
  }

  if (me.captainSuggestion) {
    alerts.push({ id: 'CAPTAIN', type: 'CAPTAIN', severity: 'info', title: `Capitaine optimal : ${me.captainSuggestion.name}`, detail: `Projection ${fmtN(me.captainSuggestion.projection)} pts — supérieure au brassard actuel.`, playerId: me.starters.find((s) => s.player.name === me.captainSuggestion!.name)?.player.id })
  }
  const order = { danger: 0, warning: 1, info: 2, success: 3 } as const
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 12)
}

// ─── Ligue réelle ────────────────────────────────────────────────────────────

export async function buildLeagueData(ctx: Ctx, settings: CoachSettings, rowsById: Map<number, PlayerRow>, rows: PlayerRow[], myPicks: fpl.FplPicks, myMetrics: SquadMetrics, myTotal: number): Promise<LeagueData> {
  if (!settings.leagueId) throw new Error(NEED_SETUP)
  const standing = await fpl.getLeagueStandings(settings.leagueId)
  const results = standing.standings.results
  const myEntryId = settings.teamId!

  const ownership = new Map<number, string[]>() // playerId → rivaux
  const rivalsData: { name: string; owner: string; entryId: number; total: number; picks: fpl.FplPicks; metrics: SquadMetrics }[] = []

  for (const res of results) {
    if (res.entry === myEntryId) continue
    try {
      const picks = await picksFor(res.entry, ctx.focusGw)
      const metrics = squadMetrics(rowsById, picks)
      rivalsData.push({ name: res.entry_name, owner: res.player_name, entryId: res.entry, total: res.total, picks, metrics })
      for (const p of picks.picks) {
        const arr = ownership.get(p.element) ?? []
        arr.push(res.entry_name)
        ownership.set(p.element, arr)
      }
    } catch { /* rival introuvable → ignoré */ }
  }

  const standings = results.map((res, i) => {
    const isMine = res.entry === myEntryId
    let sq = 0, proj = 0
    if (isMine) { sq = myMetrics.squadScore; proj = Math.round(myMetrics.projected) }
    else {
      const r = rivalsData.find((x) => x.entryId === res.entry)
      sq = r?.metrics.squadScore ?? 0; proj = Math.round(r?.metrics.projected ?? 0)
    }
    return { rank: res.rank_sort ?? i + 1, teamName: res.entry_name, ownerName: res.player_name, isMine, totalPoints: res.total, squadScore: sq, projectedGwPoints: proj }
  })

  const rivals: RivalAnalysis[] = rivalsData.map((r) => {
    const overlap = [...r.metrics.overlapIds].filter((id) => myMetrics.overlapIds.has(id)).length
    const diff = r.metrics.projected - myMetrics.projected
    const threatLevel: RivalAnalysis['threatLevel'] = diff >= 4 ? 'HIGH' : diff >= -1 ? 'MEDIUM' : 'LOW'
    const threats = r.metrics.starters
      .filter((e) => !myMetrics.overlapIds.has(e.player.fplId) && e.player.projection >= 5)
      .sort((a, b) => b.player.projection - a.player.projection).slice(0, 3)
      .map((e) => ({ name: e.player.name, position: e.player.position, teamShort: e.player.teamShort, projection: e.player.projection, price: e.player.price }))
    const top = threats[0]
    const advice = threatLevel === 'HIGH'
      ? `Proj. J${ctx.focusGw} supérieure de ${fmtN(r.metrics.projected - myMetrics.projected)} pts${top ? ` — il mise sur ${top.name} (${fmtN(top.projection)}) : contre ou différentiel.` : '.'}`
      : threatLevel === 'MEDIUM'
        ? 'Profil proche du tien — le capitaine et les différentiels feront la différence.'
        : 'Projeté derrière toi cette journée — joue ton jeu, pas le sien.'
    return {
      teamName: r.name, ownerName: r.owner, totalPoints: r.total, squadScore: r.metrics.squadScore,
      projectedGwPoints: Math.round(r.metrics.projected), threatLevel, overlap, threats, advice,
      squad: [...r.metrics.starters, ...r.metrics.bench].map((e) => ({ name: e.player.name, position: e.player.position, teamShort: e.player.teamShort, isCaptain: e.isCaptain, projection: e.player.projection, verdict: e.player.verdict })),
    }
  }).sort((a, b) => b.projectedGwPoints - a.projectedGwPoints)

  const differentials = rows
    .filter((p) => !p.ownedByMe && (ownership.get(p.fplId)?.length ?? 0) === 0 && p.projection >= 5 && p.price <= 9.5 && p.status !== 'INJURED' && p.status !== 'SUSPENDED')
    .sort((a, b) => b.projection - a.projection).slice(0, 8)

  return { leagueName: standing.league.name, myScore: myTotal, standings, rivals, differentials }
}

// ─── Orchestration ───────────────────────────────────────────────────────────

export interface CoachData {
  me: MyTeamOverview
  alerts: AlertItem[]
  transfers: TransferPlan
  nextGw: number
  seasonLabel: string
  live: LiveNow | null
  syncedAt: string
  rows: PlayerRow[]
  rowsById: Map<number, PlayerRow>
  league: LeagueData
}

export async function getCoachData(): Promise<CoachData> {
  const settings = await getSettings()
  if (!settings.teamId || !settings.leagueId) throw new Error(NEED_SETUP)
  const ctx = await buildCtx()

  const [entry, history] = await Promise.all([fpl.getEntry(settings.teamId), fpl.getEntryHistory(settings.teamId)])
  const myPicks = await picksFor(settings.teamId, ctx.focusGw)

  const rows = await buildRows(ctx, { myIds: new Set(myPicks.picks.map((p) => p.element)) })
  const rowsById = new Map(rows.map((r) => [r.fplId, r]))
  const myMetrics = squadMetrics(rowsById, myPicks)

  // Ligue réelle : rivaux + possession dans la ligue → enrichit ownedByRivals
  const standing = await fpl.getLeagueStandings(settings.leagueId)
  const ownership = new Map<number, string[]>()
  const rivalPicksList: { entryId: number; name: string; picks: fpl.FplPicks }[] = []
  for (const res of standing.standings.results) {
    if (res.entry === settings.teamId) continue
    try {
      const picks = await picksFor(res.entry, ctx.focusGw)
      rivalPicksList.push({ entryId: res.entry, name: res.entry_name, picks })
      for (const p of picks.picks) ownership.set(p.element, [...(ownership.get(p.element) ?? []), res.entry_name])
    } catch { /* ignoré */ }
  }
  for (const r of rows) r.ownedByRivals = ownership.get(r.fplId) ?? []

  // Points LIVE réels de la journée en cours (multipliant capitaine inclus)
  let live: LiveNow | null = null
  if (ctx.currentGw) {
    try {
      const [curPicks, curLive] = await Promise.all([fpl.getEntryPicks(settings.teamId, ctx.currentGw), fpl.getLive(ctx.currentGw, true)])
      const statsById = new Map(curLive.elements.map((e) => [e.id, e.stats]))
      let points = 0
      let remaining = 0
      for (const p of curPicks.picks.filter((x) => x.position <= 11)) {
        const st = statsById.get(p.element)
        const row = rowsById.get(p.element)
        if (st) points += st.total_points * p.multiplier
        if (row) {
          const tid = Number(row.teamId)
          const fx = ctx.fixtures.find((f) => f.event === ctx.currentGw && !f.started && (f.team_h === tid || f.team_a === tid))
          if (fx) remaining++
        }
      }
      live = { gw: ctx.currentGw, points, remaining }
    } catch { /* pas de live */ }
  }

  const me = await buildMyTeam(ctx, settings, rowsById, myPicks, entry, history)
  me.rank = standing.standings.results.findIndex((r) => r.entry === settings.teamId) + 1 || 0
  me.leagueSize = standing.standings.results.length || me.leagueSize

  const league = await buildLeagueData(ctx, settings, rowsById, rows, myPicks, myMetrics, me.totalPoints)
  const transfers = buildTransfers(ctx, rows, me, myPicks)
  const alerts = buildAlerts(ctx, rows, me, league.rivals)

  return {
    me, alerts, transfers, nextGw: ctx.focusGw, seasonLabel: ctx.seasonLabel, live,
    syncedAt: new Date().toISOString(), rows, rowsById, league,
  }
}

export async function getPlayersData(): Promise<{ players: PlayerRow[]; nextGw: number; hasOwnership: boolean }> {
  const settings = await getSettings()
  const ctx = await buildCtx()
  if (!settings.teamId) {
    const rows = await buildRows(ctx, {})
    return { players: rows, nextGw: ctx.focusGw, hasOwnership: false }
  }
  const myPicks = await picksFor(settings.teamId, ctx.focusGw)
  const myIds = new Set(myPicks.picks.map((p) => p.element))
  const ownership = new Map<number, string[]>()
  if (settings.leagueId) {
    try {
      const standing = await fpl.getLeagueStandings(settings.leagueId)
      for (const res of standing.standings.results) {
        if (res.entry === settings.teamId) continue
        try {
          const picks = await picksFor(res.entry, ctx.focusGw)
          for (const p of picks.picks) ownership.set(p.element, [...(ownership.get(p.element) ?? []), res.entry_name])
        } catch { /* ignoré */ }
      }
    } catch { /* ligue indisponible */ }
  }
  const rows = await buildRows(ctx, { myIds, ownership })
  return { players: rows, nextGw: ctx.focusGw, hasOwnership: true }
}

export async function getFixturesData(): Promise<{ teams: TeamFixtureRow[]; nextGw: number; seasonLabel: string }> {
  const ctx = await buildCtx()
  const teams: TeamFixtureRow[] = []
  for (const t of ctx.teams.values()) {
    const fixtures: FixtureChip[] = []
    for (const f of (ctx.upcomingByTeam.get(t.id) ?? [])) {
      if (fixtures.length >= FIX_WINDOW + 2) break
      const home = f.team_h === t.id
      const opp = ctx.teams.get(home ? f.team_a : f.team_h)
      if (!opp || f.event == null) continue
      fixtures.push({ gw: f.event, opp: opp.short_name, venue: home ? 'H' : 'A', difficulty: home ? f.team_h_difficulty : f.team_a_difficulty })
    }
    const diffs = fixtures.slice(0, FIX_WINDOW).map((f) => f.difficulty)
    const avgDiff = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 3
    teams.push({ id: String(t.id), name: t.name, short: t.short_name, fixtures, fixtureScore: clamp(Math.round(((6 - avgDiff) / 5) * 100), 0, 100) })
  }
  return { teams, nextGw: ctx.focusGw, seasonLabel: ctx.seasonLabel }
}
