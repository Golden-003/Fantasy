// ─── Moteur de scoring Fantasy ──────────────────────────────────────────────
// Data Provider → Normalisation → DB → Analytics
import { db } from '@/lib/db'
import type {
  AlertItem, BuyCandidate, FixtureChip, LeagueData, MyTeamOverview, PlayerRow,
  PlayerStats, Position, RivalAnalysis, SellCandidate, SquadEntry, TransferPlan, Verdict,
} from './types'

// ── Helpers ────────────────────────────────────────────────────────────────
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100

const ATTACK_FACTOR = [1, 1.16, 1.1, 1.0, 0.9, 0.82] // index = difficulté
const GW_WEIGHTS = [0.32, 0.26, 0.2, 0.13, 0.09] // J+1 pèse le plus
const FORM_WEIGHTS = [0.3, 0.25, 0.2, 0.15, 0.1] // dernier match pèse le plus

export function attackDifficulty(oppDef: number, venue: 'H' | 'A'): number {
  return clamp(Math.round(oppDef + (venue === 'A' ? 0.6 : -0.4)), 1, 5)
}
export function cleanSheetDifficulty(oppAtt: number, venue: 'H' | 'A'): number {
  return clamp(Math.round(oppAtt + (venue === 'A' ? 0.6 : -0.4)), 1, 5)
}
export function fixturePoints(difficulty: number): number {
  return ((5 - difficulty) / 4) * 100
}

const VERDICT_LABEL: Record<Verdict, string> = { GREEN: 'Bon investissement', YELLOW: 'À surveiller', RED: 'À éviter' }
export const verdictLabel = (v: Verdict) => VERDICT_LABEL[v]
export const verdictEmoji = (v: Verdict) => (v === 'GREEN' ? '🟢' : v === 'YELLOW' ? '🟡' : '🔴')

// ── Chargement + calcul ────────────────────────────────────────────────────
type Cache = { data: CoachData; ts: number } | null
let cache: Cache = null
const TTL = 30_000

export interface CoachData {
  players: PlayerRow[]
  playerById: Map<string, PlayerRow>
  teamScores: Map<string, number>
  me: MyTeamOverview
  rivalsRaw: { fantasyTeamId: string; teamName: string; ownerName: string; totalPoints: number; bank: number; transfersLeft: number; starters: PlayerRow[]; bench: PlayerRow[]; captain: string; squadScore: number; projectedGwPoints: number }[]
  alerts: AlertItem[]
  transfers: TransferPlan
  differentials: PlayerRow[]
  nextGw: number
  seasonLabel: string
}

export async function getCoachData(): Promise<CoachData> {
  if (cache && Date.now() - cache.ts < TTL) return cache.data
  const data = await computeAll()
  cache = { data, ts: Date.now() }
  return data
}

async function computeAll(): Promise<CoachData> {
  const [teams, players, fixtures, fantasyTeams, slots] = await Promise.all([
    db.team.findMany(),
    db.player.findMany(),
    db.fixture.findMany({ orderBy: { gw: 'asc' } }),
    db.fantasyTeam.findMany(),
    db.squadSlot.findMany({ orderBy: { slot: 'asc' } }),
  ])

  const teamById = new Map(teams.map((t) => [t.id, t]))
  const currentGw = Math.max(...fixtures.map((f) => f.gw <= 8 ? f.gw : 0))
  const nextGw = currentGw + 1

  // ── Calendrier par équipe (5 prochaines journées) ──
  const teamFixtures = new Map<string, { gw: number; oppShort: string; venue: 'H' | 'A'; oppDef: number; oppAtt: number }[]>()
  for (const f of fixtures) {
    if (f.gw < nextGw || f.gw >= nextGw + 5) continue
    const h = teamById.get(f.homeTeamId)!, a = teamById.get(f.awayTeamId)!
    ;(teamFixtures.get(f.homeTeamId) ?? teamFixtures.set(f.homeTeamId, []).get(f.homeTeamId)!).push({ gw: f.gw, oppShort: a.shortName, venue: 'H', oppDef: a.def, oppAtt: a.att })
    ;(teamFixtures.get(f.awayTeamId) ?? teamFixtures.set(f.awayTeamId, []).get(f.awayTeamId)!).push({ gw: f.gw, oppShort: h.shortName, venue: 'A', oppDef: h.def, oppAtt: h.att })
  }

  const teamScores = new Map<string, number>()
  for (const t of teams) {
    const fx = teamFixtures.get(t.id) ?? []
    let score = 0
    fx.forEach((f, i) => { score += GW_WEIGHTS[i] * fixturePoints(attackDifficulty(f.oppDef, f.venue)) })
    teamScores.set(t.id, r1(score))
  }

  // ── Possession par les équipes fantasy ──
  const slotsByTeam = new Map<string, typeof slots>()
  for (const s of slots) { (slotsByTeam.get(s.fantasyTeamId) ?? slotsByTeam.set(s.fantasyTeamId, []).get(s.fantasyTeamId)!).push(s) }
  const ownedByMeIds = new Set<string>()
  const ownedByRivals = new Map<string, string[]>() // playerId → [ownerName]
  for (const ft of fantasyTeams) {
    const ss = slotsByTeam.get(ft.id) ?? []
    if (ft.isMine) ss.forEach((s) => ownedByMeIds.add(s.playerId))
    else ss.forEach((s) => { (ownedByRivals.get(s.playerId) ?? ownedByRivals.set(s.playerId, []).get(s.playerId)!).push(ft.ownerName) })
  }

  // ── Construire les PlayerRow ──
  const rows = new Map<string, PlayerRow>()
  for (const p of players) {
    const team = teamById.get(p.teamId)!
    const stats = JSON.parse(p.statsJson) as PlayerStats
    const last5 = JSON.parse(p.last5Json)
    const chips: FixtureChip[] = (teamFixtures.get(p.teamId) ?? []).map((f) => ({
      gw: f.gw, opp: f.oppShort, venue: f.venue,
      difficulty: p.position === 'GK' ? cleanSheetDifficulty(f.oppAtt, f.venue) : attackDifficulty(f.oppDef, f.venue),
    }))

    const form = last5.length ? r2(last5.reduce((acc: number, m: { rating: number }, i: number) => acc + m.rating * FORM_WEIGHTS[i], 0)) : p.rating
    const minutesPct = stats.apps > 0 ? clamp(stats.minutes / (stats.apps * 90), 0, 1) : 0

    let expMin = stats.apps > 0 ? clamp(stats.starts / stats.apps, 0, 1) : 0.5
    if (p.rotationRisk === 'HIGH') expMin *= 0.75
    else if (p.rotationRisk === 'MEDIUM') expMin *= 0.9
    if (p.status === 'DOUBTFUL') expMin *= 0.55
    if (p.status === 'INJURED' || p.status === 'SUSPENDED') expMin = 0
    expMin = clamp(expMin, 0.05, 0.95)

    const base = p.rating * 0.5 + form * 0.5
    const minutesFactor = 0.45 + 0.55 * expMin
    const trendFactor = p.trend === 'UP' ? 1.05 : p.trend === 'DOWN' ? 0.94 : 1
    // Pondération par la production réelle : évite qu'un joueur moyen sur une série facile
    // projette comme une star. La production (xG+xA/app, ou clean sheets) module la note.
    // La note Sofascore récompense le travail défensif/le volume ; le fantasy récompense
    // les buts/passes/clean sheets → production et poste corrigent l'échelle.
    let prodFactor = 1
    let posDiscount = 1
    if (p.position === 'MID' || p.position === 'FWD') {
      const prodPerApp = stats.apps > 0 ? (stats.xg + stats.xa) / stats.apps : 0
      prodFactor = clamp(0.7 + prodPerApp * 0.3, 0.7, 1.12)
    } else if (p.position === 'DEF') {
      const csRate = stats.apps > 0 ? stats.cleanSheets / stats.apps : 0
      prodFactor = clamp(0.88 + csRate * 0.2, 0.88, 1.08)
      posDiscount = 0.93
    } else if (p.position === 'GK') {
      posDiscount = 0.88
    }
    const fixtureDamp = clamp(0.55 + (p.quality ?? 70) / 220, 0.6, 1) // les stars profitent pleinement d'un calendrier facile

    let projection = 0
    let projection5 = 0
    if (p.status === 'INJURED' || p.status === 'SUSPENDED') {
      projection = 0
      projection5 = 0
    } else {
      const nextD = chips[0]?.difficulty ?? 3
      const factor = ATTACK_FACTOR[nextD]
      const softFactor = p.position === 'GK' ? 1 + (factor - 1) * 0.5 : 1 + (factor - 1) * fixtureDamp
      projection = clamp(base * minutesFactor * softFactor * trendFactor * prodFactor * posDiscount, 0, 9.5)
      projection5 = chips.length
        ? chips.reduce((acc, c) => {
            const f = ATTACK_FACTOR[c.difficulty]
            const sf = p.position === 'GK' ? 1 + (f - 1) * 0.5 : 1 + (f - 1) * fixtureDamp
            return acc + base * minutesFactor * sf * trendFactor * prodFactor * posDiscount
          }, 0) / chips.length
        : projection
      projection = r2(projection)
      projection5 = r2(projection5)
    }

    const row: PlayerRow = {
      id: p.id, name: p.name, teamId: p.teamId, teamShort: team.shortName, teamName: team.name,
      position: p.position as Position, price: p.price, ownership: p.ownership,
      status: p.status as PlayerRow['status'], injuryNote: p.injuryNote,
      rotationRisk: p.rotationRisk as PlayerRow['rotationRisk'], trend: p.trend as PlayerRow['trend'],
      rating: p.rating, form, minutesPct: Math.round(minutesPct * 100), expectedMinutes: Math.round(expMin * 100) / 100,
      stats, last5, fixtures: chips,
      fixtureScore: teamScores.get(p.teamId) ?? 50,
      projection, projection5,
      verdict: 'YELLOW', reasons: [],
      ownedByMe: ownedByMeIds.has(p.id),
      ownedByRivals: ownedByRivals.get(p.id) ?? [],
    }
    computeVerdict(row)
    rows.set(p.id, row)
  }

  // ── Mon équipe ──
  const meFt = fantasyTeams.find((f) => f.isMine)!
  const mySlots = slotsByTeam.get(meFt.id) ?? []
  const starters: SquadEntry[] = mySlots.filter((s) => s.isStarter).map((s) => ({ slot: s.slot, isStarter: true, isCaptain: s.isCaptain, player: rows.get(s.playerId)! }))
  const bench: SquadEntry[] = mySlots.filter((s) => !s.isStarter).map((s) => ({ slot: s.slot, isStarter: false, isCaptain: false, player: rows.get(s.playerId)! }))
  const xiProj = starters.reduce((a, s) => a + s.player.projection, 0)
  const avgXI = xiProj / Math.max(1, starters.length)
  const benchProj = bench.reduce((a, s) => a + s.player.projection, 0) / Math.max(1, bench.length)
  const squadScore = Math.round(clamp(((avgXI - 3.2) / 5.2) * 100 + benchProj * 1.5, 0, 100))
  const projectedGwPoints = Math.round(xiProj * 1.9)

  const bestCaptain = [...starters].sort((a, b) => b.player.projection - a.player.projection)[0]
  const myCaptain = starters.find((s) => s.isCaptain)
  const captainSuggestion = bestCaptain && myCaptain && bestCaptain.player.id !== myCaptain.player.id
    ? { name: bestCaptain.player.name, projection: bestCaptain.player.projection }
    : null

  const weakestStarters = [...starters]
    .sort((a, b) => a.player.projection - b.player.projection)
    .slice(0, 3)
    .map((s) => ({ name: s.player.name, projection: s.player.projection, verdict: s.player.verdict, reason: s.player.reasons[0] ?? '' }))

  const me: MyTeamOverview = {
    teamName: meFt.teamName, ownerName: meFt.ownerName, bank: meFt.bank, transfersLeft: meFt.transfersLeft,
    totalPoints: meFt.totalPoints, rank: 0, squadScore, teamValue: r1([...mySlots].reduce((a, s) => a + (rows.get(s.playerId)?.price ?? 0), 0)),
    starters, bench, captainSuggestion, projectedGwPoints, weakestStarters,
  }

  // ── Rivaux (brut) ──
  const rivalsRaw = fantasyTeams.filter((f) => !f.isMine).map((ft) => {
    const ss = slotsByTeam.get(ft.id) ?? []
    const st = ss.filter((s) => s.isStarter).map((s) => ({ slot: s.slot, isStarter: true, isCaptain: s.isCaptain, player: rows.get(s.playerId)! }))
    const bn = ss.filter((s) => !s.isStarter).map((s) => ({ slot: s.slot, isStarter: false, isCaptain: false, player: rows.get(s.playerId)! }))
    const xi = st.reduce((a, s) => a + s.player.projection, 0)
    const score = Math.round(clamp(((xi / Math.max(1, st.length) - 3.2) / 5.2) * 100 + (bn.reduce((a, s) => a + s.player.projection, 0) / Math.max(1, bn.length)) * 1.5, 0, 100))
    const captainName = st.find((s) => s.isCaptain)?.player.name ?? '—'
    return {
      fantasyTeamId: ft.id, teamName: ft.teamName, ownerName: ft.ownerName, totalPoints: ft.totalPoints,
      bank: ft.bank, transfersLeft: ft.transfersLeft,
      starters: st.map((s) => s.player), bench: bn.map((s) => s.player), captain: captainName,
      squadScore: score, projectedGwPoints: Math.round(xi * 1.9),
    }
  })

  const standings = [
    { teamName: me.teamName, ownerName: me.ownerName, isMine: true, totalPoints: me.totalPoints, squadScore: me.squadScore, projectedGwPoints: me.projectedGwPoints },
    ...rivalsRaw.map((r) => ({ teamName: r.teamName, ownerName: r.ownerName, isMine: false, totalPoints: r.totalPoints, squadScore: r.squadScore, projectedGwPoints: r.projectedGwPoints })),
  ].sort((a, b) => b.totalPoints - a.totalPoints)
  me.rank = standings.findIndex((s) => s.isMine) + 1

  // ── Alertes ──
  const alerts = computeAlerts(rows, starters, rivalsRaw, captainSuggestion)

  // ── Transferts ──
  const transfers = computeTransfers(meFt.bank, meFt.transfersLeft, starters, bench, rows)

  // ── Différentiels ──
  const differentials = [...rows.values()]
    .filter((p) => !p.ownedByMe && p.ownedByRivals.length === 0 && p.status === 'FIT' && p.projection >= 6.0 && p.ownership <= 18)
    .sort((a, b) => b.projection - a.projection)
    .slice(0, 8)

  return {
    players: [...rows.values()].sort((a, b) => b.projection - a.projection),
    playerById: rows,
    teamScores, me, rivalsRaw, alerts, transfers, differentials,
    nextGw,
    seasonLabel: 'Premier League 2026/27',
  }
}

// ── Verdict 🟢🟡🔴 + raisons ───────────────────────────────────────────────
function computeVerdict(row: PlayerRow) {
  const reasons: string[] = []
  if (row.status === 'SUSPENDED') {
    row.verdict = 'RED'
    row.reasons = ['Suspendu — indisponible pour la prochaine journée']
    return
  }
  if (row.status === 'INJURED') {
    row.verdict = 'RED'
    row.reasons = [`Blessé — ${row.injuryNote ?? 'indisponible'}`]
    return
  }
  if (row.status === 'DOUBTFUL') reasons.push('⚠️ Incertitude physique — test avant le coup d’envoi')

  const formGood = row.form >= 7.0
  const formBad = row.form < 6.4
  const minGood = row.expectedMinutes >= 0.62
  const minBad = row.expectedMinutes <= 0.45 || row.rotationRisk === 'HIGH'
  const fixGood = row.fixtureScore >= 55
  const fixBad = row.fixtureScore <= 42
  const isAttacker = row.position === 'MID' || row.position === 'FWD'
  const prodGood = isAttacker
    ? row.stats.apps > 0 && (row.stats.xg + row.stats.xa) / row.stats.apps >= 0.55
    : row.stats.apps > 0 && row.stats.cleanSheets / row.stats.apps >= 0.4

  let green = 0, red = 0
  if (formGood) { green++; reasons.push(`📈 Forme : ${row.form}/10 sur les 5 derniers matchs`) }
  if (formBad) { red++; reasons.push(`📉 Forme en baisse : ${row.form}/10`) }
  if (minGood) { green++; reasons.push(`⏱️ Temps de jeu solide (${row.minutesPct}% des minutes)`) }
  if (minBad) { red++; reasons.push(row.rotationRisk === 'HIGH' ? '🔄 Risque de rotation élevé' : `⏱️ Temps de jeu incertain (${row.minutesPct}%)`) }
  if (fixGood) { green++; reasons.push(`📅 Calendrier favorable sur 5 journées (${Math.round(row.fixtureScore)}/100)`) }
  if (fixBad) { red++; reasons.push(`📅 Calendrier difficile (${Math.round(row.fixtureScore)}/100)`) }
  if (prodGood) { green++; reasons.push(isAttacker ? `🎯 Production offensive : ${row.stats.goals}B / ${row.stats.assists}P (xG+xA : ${(row.stats.xg + row.stats.xa).toFixed(1)})` : `🧱 Solide défensivement : ${row.stats.cleanSheets} clean sheets`) }
  if (row.trend === 'DOWN') { red++; reasons.push('📉 Tendance à la baisse') }
  if (row.trend === 'UP' && row.projection >= 6.5) { green++; reasons.push('🔥 En progression sur les derniers matchs') }
  if (row.projection >= 7.2) { green++; reasons.push(`⚡ Projection J+1 élevée : ${row.projection}`) }
  if (row.projection < 5.6) { red++; reasons.push(`⬇️ Projection J+1 faible : ${row.projection}`) }
  if (row.ownership >= 40) reasons.push(`👥 Très possédé (${row.ownership}% de la ligue)`)
  else if (row.ownership <= 10) reasons.push(`💎 Différentiel (${row.ownership}% de la ligue)`)

  row.reasons = reasons
  if (row.status === 'DOUBTFUL' && red >= 2) { row.verdict = 'RED'; return }
  if (green >= 4 && row.projection >= 6.8) row.verdict = 'GREEN'
  else if (red >= 3 || row.projection < 5.5) row.verdict = 'RED'
  else row.verdict = 'YELLOW'
  if (reasons.length === 0) row.reasons.push('Profil stable, ni priorité ni urgence')
}

// ── Alertes ────────────────────────────────────────────────────────────────
function computeAlerts(
  rows: Map<string, PlayerRow>,
  starters: SquadEntry[],
  rivals: CoachData['rivalsRaw'],
  captainSuggestion: MyTeamOverview['captainSuggestion'],
): AlertItem[] {
  const alerts: AlertItem[] = []
  const myIds = new Set(starters.map((s) => s.player.id))

  // Risques sur mon effectif
  for (const s of starters) {
    const p = s.player
    if (p.status === 'INJURED' || p.status === 'SUSPENDED') {
      alerts.push({ id: `sq-${p.id}`, type: 'SQUAD_RISK', severity: 'danger', title: `🚨 ${p.name} indisponible`, detail: p.injuryNote ?? 'Absent pour la prochaine journée — pense à le remplacer.', playerId: p.id })
    } else if (p.status === 'DOUBTFUL') {
      alerts.push({ id: `sq-${p.id}`, type: 'SQUAD_RISK', severity: 'warning', title: `⚠️ ${p.name} incertain`, detail: p.injuryNote ?? 'Test physique avant le match — prévois un plan B.', playerId: p.id })
    } else if (p.rotationRisk === 'HIGH') {
      alerts.push({ id: `sq-${p.id}`, type: 'SQUAD_RISK', severity: 'warning', title: `🔄 ${p.name} : rotation probable`, detail: `Titularisations récentes limitées (${p.stats.starts}/${p.stats.apps} matchs). Minutes incertaines.`, playerId: p.id })
    } else if (p.price >= 8 && p.form < 6.6) {
      alerts.push({ id: `sq-${p.id}`, type: 'UNDERPERF', severity: 'warning', title: `📉 ${p.name} sous-performe`, detail: `Note moyenne de ${p.form}/10 sur 5 matchs pour un joueur à ${p.price}M.`, playerId: p.id })
    }
  }

  // Opportunités différentielles
  for (const p of rows.values()) {
    if (myIds.has(p.id)) continue
    if (p.status !== 'FIT') continue
    if (p.ownership <= 15 && p.projection >= 6.6 && p.trend === 'UP' && p.fixtureScore >= 55) {
      alerts.push({ id: `op-${p.id}`, type: 'OPPORTUNITY', severity: 'success', title: `💎 Opportunité : ${p.name} (${p.teamShort})`, detail: `Seulement ${p.ownership}% de possession, projection ${p.projection} en J+1, calendrier favorable (${Math.round(p.fixtureScore)}/100). Prix : ${p.price}M.`, playerId: p.id })
    }
  }

  // Joueurs en forme
  for (const p of rows.values()) {
    if (p.last5.length >= 3) {
      const last3 = p.last5.slice(0, 3)
      const avg3 = last3.reduce((a, m) => a + m.rating, 0) / 3
      if (avg3 >= 7.7 && p.status === 'FIT') {
        alerts.push({ id: `fm-${p.id}`, type: 'FORM', severity: 'info', title: `🔥 ${p.name} est en feu`, detail: `${avg3.toFixed(1)} de note moyenne sur les 3 derniers matchs. Prochaine affiche : ${p.fixtures[0]?.opp ?? '?'} (${p.fixtures[0]?.venue === 'H' ? 'domicile' : 'extérieur'}).`, playerId: p.id })
      }
    }
  }

  // Menaces rivaux
  for (const r of rivals) {
    for (const p of r.starters) {
      if (p.projection >= 7.3 && !p.ownedByMe && p.status === 'FIT') {
        alerts.push({ id: `rv-${r.ownerName}-${p.id}`, type: 'RIVAL_THREAT', severity: 'danger', title: `🎯 ${r.ownerName} aligne ${p.name}`, detail: `${p.projection} de projection en J+1 et il n'est pas dans ton équipe. ${p.ownedByRivals.length > 1 ? `${p.ownedByRivals.length} rivaux le possèdent.` : 'Il est seul à le posséder.'}`, playerId: p.id })
      }
    }
  }

  if (captainSuggestion) {
    alerts.push({ id: 'cap-1', type: 'CAPTAIN', severity: 'info', title: `🧢 Capitaine : mets le brassard sur ${captainSuggestion.name}`, detail: `Projection de ${captainSuggestion.projection} en J+1 — la plus haute de ton XI.`, playerId: undefined })
  }

  const order: Record<AlertItem['severity'], number> = { danger: 0, warning: 1, success: 2, info: 3 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 14)
}

// ── Transferts ─────────────────────────────────────────────────────────────
function computeTransfers(bank: number, transfersLeft: number, starters: SquadEntry[], bench: SquadEntry[], rows: Map<string, PlayerRow>): TransferPlan {
  const mine = [...starters, ...bench].map((s) => s.player)

  const sell: SellCandidate[] = mine
    .filter((p) => p.verdict === 'RED' || p.status !== 'FIT' || p.rotationRisk === 'HIGH' || p.projection < 6.0)
    .sort((a, b) => a.projection - b.projection)
    .map((p) => ({
      player: p,
      reason: p.status === 'SUSPENDED' ? 'Suspendu — sortie obligatoire'
        : p.status === 'INJURED' ? 'Blessé — indisponible'
        : p.status === 'DOUBTFUL' ? 'Incertitude physique'
        : p.rotationRisk === 'HIGH' ? 'Rotation probable — minutes incertaines'
        : p.verdict === 'RED' ? verdictLabel('RED') + ' : ' + (p.reasons[0] ?? 'rendement faible')
        : `Projection faible (${p.projection}) vs marché`,
    }))

  const budgetAfterSell = bank + Math.max(...sell.map((s) => s.player.price), 0)
  const myByPos = (pos: Position) => mine.filter((p) => p.position === pos).sort((a, b) => b.projection - a.projection)

  const candidates = [...rows.values()].filter((p) => !p.ownedByMe && p.status === 'FIT')
  const buys: BuyCandidate[] = []
  for (const p of candidates) {
    const samePos = myByPos(p.position)
    const upgradeTarget = samePos[samePos.length - 1] // le plus faible du poste
    const netGain = upgradeTarget ? r2(p.projection - upgradeTarget.projection) : null
    const affordable = p.price <= budgetAfterSell + 0.01
    const differential = p.ownership <= 12 || p.ownedByRivals.length === 0
    const valueRatio = p.projection / Math.max(4.4, p.price)
    const score = p.projection + p.fixtureScore / 100 * 0.4 + (differential ? 0.6 : 0) + valueRatio * 0.3
    if (p.projection < 5.8) continue
    buys.push({
      player: p, netGain, comparedTo: upgradeTarget?.name ?? null, affordable, differential,
      justification: [
        `Projection ${p.projection} en J+1 (moy. ${p.projection5} sur 5 journées)`,
        `Calendrier ${Math.round(p.fixtureScore)}/100`,
        differential ? `Differential : ${p.ownedByRivals.length === 0 ? 'aucun rival ne le possède' : `seulement ${p.ownership}% de possession`}` : `${p.ownership}% de possession`,
        p.price <= bank ? `Achetable cash (${p.price}M ≤ ${bank}M en banque)` : affordable ? `Nécessite un sell-up (≈ ${budgetAfterSell.toFixed(1)}M dispo après vente)` : 'Budget insuffisant sans vente',
      ].join(' • '),
      _score: score,
    } as BuyCandidate & { _score: number })
  }

  const buy = (buys as (BuyCandidate & { _score: number })[])
    .sort((a, b) => b._score - a._score)
    .slice(0, 12)
    .map(({ _score, ...rest }) => rest as BuyCandidate)

  return { bank, transfersLeft, sell, buy }
}

// ── War Room ───────────────────────────────────────────────────────────────
export function buildLeagueData(data: CoachData): LeagueData {
  const myIds = new Set(data.me.starters.map((s) => s.player.id))
  const rivals: RivalAnalysis[] = data.rivalsRaw.map((r) => {
    const threats = r.starters
      .filter((p) => !p.ownedByMe)
      .sort((a, b) => b.projection - a.projection)
      .slice(0, 3)
      .map((p) => ({ name: p.name, position: p.position, teamShort: p.teamShort, projection: p.projection, price: p.price }))
    const overlap = r.starters.filter((p) => myIds.has(p.id)).length
    const diff = r.squadScore - data.me.squadScore
    const threatLevel: RivalAnalysis['threatLevel'] = diff >= 4 ? 'HIGH' : diff >= -2 ? 'MEDIUM' : 'LOW'
    const topThreat = threats[0]
    const advice = threatLevel === 'HIGH'
      ? topThreat
        ? `${r.ownerName} est devant. Piste n°1 : récupérer ${topThreat.name} (${topThreat.projection} proj.) ou viser un différentiel fort pour compenser.`
        : `${r.ownerName} est devant. Vise un différentiel à haute projection pour reprendre des points.`
      : threatLevel === 'MEDIUM'
        ? `Équilibré avec ${r.ownerName}. Le capitaine et les différentiels feront la différence. Garde ${r.transfersLeft} transfert(s) en tête.`
        : `${r.ownerName} est derrière sur la projection. Consolide : pas de risque inutile, capitalise sur ton XI.`
    return {
      teamName: r.teamName, ownerName: r.ownerName, totalPoints: r.totalPoints, squadScore: r.squadScore,
      projectedGwPoints: r.projectedGwPoints, threatLevel, overlap, threats, advice,
      squad: [...r.starters, ...r.bench].map((p) => ({ name: p.name, position: p.position, teamShort: p.teamShort, isCaptain: p.name === r.captain, projection: p.projection, verdict: p.verdict })),
    }
  }).sort((a, b) => b.squadScore - a.squadScore)

  const standings = [
    { teamName: data.me.teamName, ownerName: data.me.ownerName, isMine: true, totalPoints: data.me.totalPoints, squadScore: data.me.squadScore, projectedGwPoints: data.me.projectedGwPoints },
    ...data.rivalsRaw.map((r) => ({ teamName: r.teamName, ownerName: r.ownerName, isMine: false, totalPoints: r.totalPoints, squadScore: r.squadScore, projectedGwPoints: r.projectedGwPoints })),
  ].sort((a, b) => b.totalPoints - a.totalPoints).map((s, i) => ({ ...s, rank: i + 1 }))

  return { myScore: data.me.squadScore, standings, rivals, differentials: data.differentials }
}
