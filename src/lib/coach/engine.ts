// ═══════════════════════════════════════════════════════════════
// MOTEUR COACH — Sofascore Fantasy Premier League 2026/27
// Ligue privée « Le fond de la classe » (5 managers)
//
// Données : base complète Premier League (658 joueurs, API officielle)
// + valeurs Sofascore sourcées (24 joueurs) + saisies manuelles
// de l'utilisateur (effectifs, transferts, scores, points live).
// ═══════════════════════════════════════════════════════════════
import { db } from '@/lib/db'
import type {
  Alert, CaptainPick, Difficulty, FixtureLite, FixtureView, LeagueView,
  LivePlayerRow, LiveStandingRow, LiveView, ManagerDetail, MarketTarget, Overview, Pos,
  PlayerDetail, PlayerRow, PlayerStatus, SquadPlayerView, StandingRow, TeamView, TransferFlag, TransferItem,
} from './types'

// ── Règles officielles 2026/27 ─────────────────────────────────
export const RULES = {
  budget: 100,
  squadSize: 15,
  quota: { G: 2, D: 5, M: 5, A: 3 } as Record<Pos, number>,
  freeTransfersPerRound: 2,
  transferBankMax: 5,
  extraTransferPenalty: 5,
  captainMultiplier: 2,
  tokens: [
    { name: 'Triple Captain', effect: 'Capitaine ×3 au lieu de ×2', perSeason: 1 },
    { name: 'Quick Fix', effect: 'Transfert supplémentaire sans pénalité', perSeason: 2 },
    { name: 'Rebuild Squad', effect: 'Refonte de l’effectif', perSeason: 2, note: '1 par mi-saison' },
  ],
  maxOneTokenPerRound: true,
}

// Repli si aucune difficulté stockée (anciennes lignes)
const PROMOTED = new Set(['Leeds', 'Hull City', 'Coventry City'])
const STRONG = new Set(['Arsenal', 'Man City', 'Liverpool', 'Chelsea', 'Newcastle'])

export function difficultyFromLevel(level: number | null | undefined, opponent: string, isHome: boolean): Difficulty {
  if (level != null) return level <= 2 ? 'FACILE' : level <= 3 ? 'MOYEN' : 'DIFFICILE'
  let ease = 0
  if (isHome) ease += 1
  if (PROMOTED.has(opponent)) ease += 1.5
  if (STRONG.has(opponent)) ease -= 1.2
  return ease >= 1.2 ? 'FACILE' : ease >= 0.2 ? 'MOYEN' : 'DIFFICILE'
}

const levelOf = (d: Difficulty) => (d === 'FACILE' ? 1 : d === 'MOYEN' ? 3 : 5)

const fixtureLabel = (f: { opponent: string; isHome: boolean }) => `${f.isHome ? 'vs' : '@'} ${f.opponent}`

export const easeBonus = (d: Difficulty) => (d === 'FACILE' ? 2 : d === 'MOYEN' ? 1 : 0)

// ── Helpers ────────────────────────────────────────────────────
// Journée courante : SyncState (posée par le sync) → calcul sur kickoffs → 5.
// Cache 60 s pour éviter les allers-retours DB dans une même requête.
let roundCache: { value: number; at: number } | null = null

export async function getCurrentRound(): Promise<number> {
  if (roundCache && Date.now() - roundCache.at < 60_000) return roundCache.value
  const row = await db.syncState.findUnique({ where: { key: 'currentRound' } })
  let v = row ? parseInt(row.value) : NaN
  if (!Number.isInteger(v) || v < 1 || v > 38) {
    const now = new Date().toISOString()
    const fx = await db.fixture.findFirst({
      where: { kickoff: { gte: now } },
      orderBy: [{ round: 'asc' }, { kickoff: 'asc' }],
    })
    v = fx?.round ?? 5
  }
  roundCache = { value: v, at: Date.now() }
  return v
}

export async function getRoundDate(round: number): Promise<string | null> {
  const fx = await db.fixture.findFirst({ where: { round }, orderBy: { kickoff: 'asc' } })
  if (!fx?.kickoff) return null
  return new Date(fx.kickoff).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function statusOf(p: { status: string }): PlayerStatus {
  return p.status === 'DOUTEUX' || p.status === 'ABSENT' ? p.status : 'DISPO'
}

// ── Effectif d'un manager (généralisé) ─────────────────────────
export async function getTeam(managerSlug = 'vital_gdb'): Promise<TeamView> {
  const CURRENT_ROUND = await getCurrentRound()
  const manager = await db.manager.findUnique({
    where: { slug: managerSlug },
    include: { squads: { include: { player: true } } },
  })
  if (!manager) throw new Error('Manager introuvable')

  const fixtures = await db.fixture.findMany({ where: { round: { gte: CURRENT_ROUND } }, orderBy: { round: 'asc' } })
  const fixByClub = new Map<string, (typeof fixtures)[number]>()
  for (const f of fixtures) if (!fixByClub.has(f.club)) fixByClub.set(f.club, f)

  const view = (s: (typeof manager.squads)[number]): SquadPlayerView => {
    const p = s.player
    const fx = fixByClub.get(p.club)
    return {
      id: p.id,
      name: p.name,
      club: p.club,
      position: s.slotPosition as Pos,
      role: s.role as 'TITULAIRE' | 'BANC',
      captain: s.captain,
      pointsR4: s.pointsR4,
      price: p.price,
      priceRef: p.priceRef,
      status: statusOf(p),
      news: p.news,
      form: p.form,
      totalPoints: p.totalPoints,
      minutes: p.minutes,
      epNext: p.epNext,
      fixtureNext: fx
        ? { opponent: fx.opponent, isHome: fx.isHome, difficulty: difficultyFromLevel(fx.difficulty, fx.opponent, fx.isHome), kickoff: fx.kickoff }
        : null,
      round: fx?.round ?? CURRENT_ROUND,
    }
  }

  const starters = manager.squads.filter((s) => s.role === 'TITULAIRE').map(view)
  const bench = manager.squads.filter((s) => s.role === 'BANC').map(view)
  const order: Record<Pos, number> = { G: 0, D: 1, M: 2, A: 3 }
  starters.sort((a, b) => order[a.position] - order[b.position] || a.name.localeCompare(b.name))
  bench.sort((a, b) => order[a.position] - order[b.position] || a.name.localeCompare(b.name))

  const d = starters.filter((p) => p.position === 'D').length
  const m = starters.filter((p) => p.position === 'M').length
  const a = starters.filter((p) => p.position === 'A').length

  const priced = manager.squads.filter((s) => s.player.price != null)
  const knownSpend = priced.reduce((acc, s) => acc + (s.player.price ?? 0), 0)
  const squadValueRef = manager.squads.reduce((acc, s) => acc + (s.player.priceRef ?? 0), 0)

  const scores = await db.roundScore.findMany({
    where: { managerId: manager.id },
    orderBy: { round: 'asc' },
  })
  // total = dernier cumul officiel connu (totalAfter), sinon somme des points saisis
  const latestTotal = [...scores].filter((s) => s.totalAfter != null).sort((a, b) => b.round - a.round)[0]?.totalAfter ?? null
  const sumPoints = scores.filter((s) => s.points != null).reduce((acc, s) => acc + (s.points ?? 0), 0)
  const total = latestTotal ?? (sumPoints || null)

  return {
    managerId: manager.id,
    managerName: manager.name,
    isUser: manager.isUser,
    formation: `${d}-${m}-${a}`,
    starters,
    bench,
    knownSpend: Math.round(knownSpend * 10) / 10,
    knownPriceCount: priced.length,
    squadValueRef: Math.round(squadValueRef * 10) / 10,
    totals: {
      rounds: scores.map((s) => ({ round: s.round, points: s.points, totalAfter: s.totalAfter })),
      total,
    },
  }
}

// ── Base joueurs complète ──────────────────────────────────────
export async function getPlayersAll(): Promise<PlayerRow[]> {
  const players = await db.player.findMany({ orderBy: { name: 'asc' } })
  return players.map((p) => ({
    id: p.id, name: p.name, club: p.club, position: p.position as Pos,
    price: p.price, priceRef: p.priceRef, status: statusOf(p),
    form: p.form, totalPoints: p.totalPoints, minutes: p.minutes,
    goals: p.goals, assists: p.assists, epNext: p.epNext,
    ownership: p.ownership, ownershipRef: p.ownershipRef,
  }))
}

export async function getPlayerDetail(id: string): Promise<PlayerDetail | null> {
  const CURRENT_ROUND = await getCurrentRound()
  const p = await db.player.findUnique({ where: { id } })
  if (!p) return null
  const fixtures = await db.fixture.findMany({
    where: { club: p.club, round: { gte: CURRENT_ROUND } },
    orderBy: { round: 'asc' },
    take: 5,
  })
  return {
    id: p.id, name: p.name, club: p.club, position: p.position as Pos,
    price: p.price, priceRef: p.priceRef, status: statusOf(p),
    form: p.form, totalPoints: p.totalPoints, minutes: p.minutes,
    goals: p.goals, assists: p.assists, epNext: p.epNext,
    ownership: p.ownership, ownershipRef: p.ownershipRef,
    news: p.news, xg: p.xg, xa: p.xa, source: p.source,
    fixturesDetailed: fixtures.map((f) => ({
      round: f.round, opponent: f.opponent, isHome: f.isHome,
      difficulty: difficultyFromLevel(f.difficulty, f.opponent, f.isHome), kickoff: f.kickoff,
    })),
  } as PlayerDetail
}

// ── Capitaine — classement transparent (projection officielle) ─
export async function getCaptainPicks(team?: TeamView): Promise<CaptainPick[]> {
  const t = team ?? (await getTeam())
  const picks: Omit<CaptainPick, 'rank'>[] = []
  for (const p of t.starters) {
    if (p.status === 'ABSENT') continue
    const reasons: string[] = []
    let score = 0
    if (p.epNext != null) {
      score += p.epNext
      reasons.push(`projection ${p.epNext.toFixed(1).replace('.', ',')} pts`)
    }
    if (p.form != null) {
      score += p.form * 0.5
      reasons.push(`forme ${p.form.toFixed(1).replace('.', ',')}`)
    }
    if (p.totalPoints != null) reasons.push(`${p.totalPoints} pts cette saison`)
    if (p.status === 'DOUTEUX') {
      score -= 3
      reasons.push(p.news ? `incertitude : ${p.news}` : 'statut incertain')
    }
    if (p.fixtureNext) {
      score += easeBonus(p.fixtureNext.difficulty)
      reasons.push(`J${p.round} ${fixtureLabel(p.fixtureNext)} — ${p.fixtureNext.difficulty}`)
    }
    if (p.captain) reasons.push('capitaine sortant')
    picks.push({
      playerId: p.id, name: p.name, club: p.club, position: p.position,
      fixture: p.fixtureNext ? fixtureLabel(p.fixtureNext) : '—',
      difficulty: p.fixtureNext?.difficulty ?? 'MOYEN',
      score: Math.round(score * 10) / 10, reasons,
    })
  }
  picks.sort((x, y) => y.score - x.score)
  return picks.map((p, i) => ({ ...p, rank: i + 1 }))
}

// ── Vigilance effectif — signaux dynamiques ────────────────────
export async function getTransferFlags(team?: TeamView): Promise<TransferFlag[]> {
  const t = team ?? (await getTeam())
  const flags: TransferFlag[] = []
  for (const p of [...t.starters, ...t.bench]) {
    if (p.status === 'ABSENT') {
      flags.push({ playerId: p.id, name: p.name, kind: 'DOUTE', reason: p.news || 'indisponible actuellement' })
    } else if (p.status === 'DOUTEUX') {
      flags.push({ playerId: p.id, name: p.name, kind: 'DOUTE', reason: p.news || 'statut incertain pour la prochaine journée' })
    } else if (p.minutes != null && p.totalPoints != null && p.minutes < 180 && p.totalPoints < 12 && p.role === 'TITULAIRE') {
      flags.push({ playerId: p.id, name: p.name, kind: 'SURVEILLER', reason: `temps de jeu faible (${p.minutes} min, ${p.totalPoints} pts)` })
    } else if (p.form != null && p.form >= 6) {
      flags.push({ playerId: p.id, name: p.name, kind: 'GARDER', reason: `en forme (${p.form.toFixed(1).replace('.', ',')} de moyenne)` })
    }
  }
  const order = { DOUTE: 0, SURVEILLER: 1, GARDER: 2 } as const
  return flags.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, 6)
}

// ── Cibles marché — meilleures projections hors effectif ──────
export async function getMarketTargets(team?: TeamView): Promise<MarketTarget[]> {
  const CURRENT_ROUND = await getCurrentRound()
  const t = team ?? (await getTeam())
  const squadIds = new Set([...t.starters, ...t.bench].map((p) => p.id))
  const players = await db.player.findMany({
    where: { id: { notIn: [...squadIds] }, status: { not: 'ABSENT' }, epNext: { not: null } },
    orderBy: { epNext: 'desc' },
    take: 40,
  })
  const fixtures = await db.fixture.findMany({ where: { round: CURRENT_ROUND } })
  const fixMap = new Map(fixtures.map((f) => [f.club, f]))
  const targets: MarketTarget[] = players.map((p) => {
    const fx = fixMap.get(p.club)
    const dif = fx ? difficultyFromLevel(fx.difficulty, fx.opponent, fx.isHome) : 'MOYEN'
    return {
      playerId: p.id, name: p.name, club: p.club, position: p.position as Pos,
      price: p.price, priceRef: p.priceRef, epNext: p.epNext, form: p.form,
      rationale: fx
        ? `J${fx.round} ${fixtureLabel({ opponent: fx.opponent, isHome: fx.isHome })} — ${dif}`
        : '—',
    }
  })
  // 2 meilleurs par poste
  const byPos: Record<Pos, MarketTarget[]> = { G: [], D: [], M: [], A: [] }
  for (const t2 of targets) byPos[t2.position].push(t2)
  return [...byPos.A, ...byPos.M, ...byPos.D, ...byPos.G].slice(0, 8)
}

// ── Alertes dynamiques ─────────────────────────────────────────
export async function getAlerts(): Promise<Alert[]> {
  const [league, team, CURRENT_ROUND] = await Promise.all([getLeague(), getTeam(), getCurrentRound()])
  const alerts: Alert[] = []

  if (league.gapToLeader < 0) {
    alerts.push({
      level: 'HOT',
      title: `${league.leaderName} mène de ${Math.abs(league.gapToLeader)} points`,
      detail: `Tu es ${league.myRank}${league.myRank === 1 ? 'ᵉʳ' : 'ᵉ'} avec ${team.totals.total ?? '?'} points. Chaque journée compte pour revenir.`,
    })
  } else {
    alerts.push({ level: 'INFO', title: 'Tu mènes la ligue', detail: `+${league.gapToLeader} points d’avance sur le deuxième.` })
  }

  const last = league.standings[league.standings.length - 1]
  if (last && !last.isUser && league.gapToLast != null && Math.abs(league.gapToLast) <= 5) {
    alerts.push({
      level: 'WARN',
      title: `Marge sur la dernière place : ${Math.abs(league.gapToLast)} point(s)`,
      detail: `${last.name} est à ${last.total ?? '?'} points. La lutte est serrée.`,
    })
  }

  const squad = [...team.starters, ...team.bench]
  const absents = squad.filter((p) => p.status === 'ABSENT')
  const douteux = squad.filter((p) => p.status === 'DOUTEUX')
  if (absents.length || douteux.length) {
    alerts.push({
      level: 'WARN',
      title: 'Effectif : indisponibilités à gérer',
      detail: [
        absents.length ? `Absents : ${absents.map((p) => p.name).join(', ')}.` : '',
        douteux.length ? `Incertains : ${douteux.map((p) => p.name).join(', ')}.` : '',
      ].filter(Boolean).join(' '),
    })
  }

  const roundDate = await getRoundDate(CURRENT_ROUND)
  alerts.push({
    level: 'INFO',
    title: `J${CURRENT_ROUND}${roundDate ? ` — ${roundDate}` : ''} : 2 transferts gratuits`,
    detail: '2 transferts gratuits par journée, cumulables jusqu’à 5. Au-delà : −5 pts par transfert supplémentaire. Un seul token par journée.',
  })

  return alerts.slice(0, 4)
}

// ── Ligue ──────────────────────────────────────────────────────
export async function getLeague(): Promise<LeagueView> {
  const [managers, CURRENT_ROUND] = await Promise.all([db.manager.findMany({ orderBy: { sortOrder: 'asc' }, include: { scores: true } }), getCurrentRound()])
  const rows: StandingRow[] = managers.map((m) => {
    const known = m.scores.filter((s) => s.points != null).sort((a, b) => a.round - b.round)
    const latestTotal = [...m.scores].filter((s) => s.totalAfter != null).sort((a, b) => b.round - a.round)[0]?.totalAfter ?? null
    const sumPoints = known.reduce((acc, s) => acc + (s.points ?? 0), 0)
    const total = latestTotal ?? (sumPoints || null)
    const last = known[known.length - 1]
    return {
      rank: 0, id: m.id, slug: m.slug, name: m.name, isUser: m.isUser,
      total, lastRound: last?.round ?? null, lastPoints: last?.points ?? null, roundsKnown: known.length,
    }
  })
  rows.sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
  rows.forEach((r, i) => { r.rank = i + 1 })
  const me = rows.find((r) => r.isUser) ?? rows[0]
  return {
    name: 'Le fond de la classe',
    season: '2026/27',
    currentRound: CURRENT_ROUND,
    standings: rows,
    myRank: me.rank,
    gapToLeader: (me.total ?? 0) - (rows[0].total ?? 0),
    gapToLast: (me.total ?? 0) - (rows[rows.length - 1].total ?? 0),
    leaderName: rows[0].name,
  }
}

// ── Détail manager (effectif + transferts + scores) ────────────
export async function getManagerDetail(slug: string): Promise<ManagerDetail | null> {
  const team = await getTeam(slug)
  const m = await db.manager.findUnique({ where: { slug }, include: { transfers: { include: { outPlayer: true, inPlayer: true }, orderBy: { createdAt: 'desc' } } } })
  if (!m) return null
  const scores = await db.roundScore.findMany({ where: { managerId: m.id }, orderBy: { round: 'asc' } })
  const transfers: TransferItem[] = m.transfers.map((t) => ({
    id: t.id, round: t.round, outName: t.outPlayer?.name ?? null, inName: t.inPlayer?.name ?? null,
    note: t.note, createdAt: t.createdAt,
  }))
  return {
    id: m.id, slug: m.slug, name: m.name, isUser: m.isUser,
    squad: [...team.starters, ...team.bench],
    formation: team.formation,
    transfers,
    scores: scores.map((s) => ({ round: s.round, points: s.points, totalAfter: s.totalAfter })),
    total: team.totals.total,
  }
}

// ── Fixtures ───────────────────────────────────────────────────
export async function getFixtures(from?: number, to?: number, club?: string): Promise<{ rounds: Record<number, FixtureView[]> }> {
  const CURRENT_ROUND = await getCurrentRound()
  const f = from ?? CURRENT_ROUND
  const t = to ?? CURRENT_ROUND + 3
  const fixtures = await db.fixture.findMany({
    where: { round: { gte: f, lte: t }, ...(club ? { club } : {}) },
    orderBy: [{ round: 'asc' }, { club: 'asc' }],
  })
  const rounds: Record<number, FixtureView[]> = {}
  for (const fx of fixtures) {
    const arr = (rounds[fx.round] ??= [])
    arr.push({ round: fx.round, club: fx.club, opponent: fx.opponent, isHome: fx.isHome, difficulty: difficultyFromLevel(fx.difficulty, fx.opponent, fx.isHome), kickoff: fx.kickoff })
  }
  return { rounds }
}

// ── TEMPS RÉEL — Match Center live ────────────────────────────
export async function getLive(round?: number): Promise<LiveView> {
  const r = round ?? (await getCurrentRound())
  const [team, entries, liveRound, league] = await Promise.all([
    getTeam(),
    db.liveEntry.findMany({ where: { round: r }, include: { player: true } }),
    db.liveRound.findUnique({ where: { round: r } }),
    getLeague(),
  ])

  const entryByPlayer = new Map(entries.map((e) => [e.playerId, e]))
  const rowOf = (p: SquadPlayerView): LivePlayerRow => {
    const e = entryByPlayer.get(p.id)
    const fx = p.fixtureNext && p.round === r ? `${p.fixtureNext.isHome ? 'vs' : '@'} ${p.fixtureNext.opponent}` : null
    return {
      playerId: p.id, name: p.name, club: p.club,
      position: p.position, role: p.role, fixture: fx, pointsR4: p.pointsR4,
      points: e?.points ?? null, updatedAt: e?.updatedAt ?? null,
    }
  }
  const rows: LivePlayerRow[] = [...team.starters, ...team.bench].map(rowOf)

  const multiplier: 2 | 3 = liveRound?.tripleCaptain ? 3 : 2
  const captainPlayerId = liveRound?.captainPlayerId ?? null
  const captainEntry = captainPlayerId ? entryByPlayer.get(captainPlayerId) : undefined
  const captainIsStarter = rows.some((r) => r.playerId === captainPlayerId && r.role === 'TITULAIRE')
  const captainPoints = captainIsStarter && captainEntry?.points != null ? captainEntry.points : 0
  const captainName = rows.find((r) => r.playerId === captainPlayerId)?.name ?? null

  const starterRows = rows.filter((r) => r.role === 'TITULAIRE')
  const benchRows = rows.filter((r) => r.role === 'BANC')
  const startersEntered = starterRows.filter((r) => r.points != null).length
  const startersPoints = starterRows.reduce((acc, r) => acc + (r.points ?? 0), 0)
  const captainBonus = (multiplier - 1) * captainPoints
  const benchPoints = benchRows.reduce((acc, r) => acc + (r.points ?? 0), 0)
  const liveRoundPoints = startersPoints + captainBonus
  const baseTotal = team.totals.total ?? 0
  const updates = entries.map((e) => e.updatedAt).filter(Boolean).sort()
  const lastUpdate = updates.length ? updates[updates.length - 1] : null

  const officialRank = new Map(league.standings.map((s) => [s.name, s.rank]))
  const sim: LiveStandingRow[] = league.standings.map((s) => ({
    name: s.name,
    isUser: s.isUser,
    baseTotal: s.total,
    liveRoundPoints: s.isUser ? liveRoundPoints : null,
    projectedTotal: s.isUser ? baseTotal + liveRoundPoints : s.total,
    rank: 0,
    moved: false,
  }))
  sim.sort((a, b) => (b.projectedTotal ?? b.baseTotal ?? 0) - (a.projectedTotal ?? a.baseTotal ?? 0))
  sim.forEach((r, i) => { r.rank = i + 1; r.moved = officialRank.get(r.name) !== r.rank })

  return {
    round: r,
    roundDate: await getRoundDate(r),
    captainPlayerId,
    captainName,
    tripleCaptain: liveRound?.tripleCaptain ?? false,
    multiplier,
    rows,
    live: {
      startersEntered, startersTotal: starterRows.length,
      startersPoints, captainBonus, benchPoints, liveRoundPoints,
      baseTotal, projectedTotal: baseTotal + liveRoundPoints, lastUpdate,
    },
    standings: sim,
  }
}

export interface LiveSaveInput {
  tripleCaptain?: boolean
  captainPlayerId?: string | null
  entries?: { playerId: string; points: number | null; note?: string }[]
}

export async function saveLive(round: number, input: LiveSaveInput): Promise<LiveView> {
  if (!Number.isInteger(round) || round < 1 || round > 38) throw new Error('Journée invalide')
  const now = new Date().toISOString()

  await db.liveRound.upsert({
    where: { round },
    update: {
      captainPlayerId: input.captainPlayerId ?? undefined,
      tripleCaptain: input.tripleCaptain ?? undefined,
      updatedAt: now,
    },
    create: {
      round,
      captainPlayerId: input.captainPlayerId ?? null,
      tripleCaptain: input.tripleCaptain ?? false,
      updatedAt: now,
    },
  })

  for (const e of input.entries ?? []) {
    const data = { round, playerId: e.playerId, points: e.points, note: e.note ?? null, updatedAt: now }
    await db.liveEntry.upsert({
      where: { round_playerId: { round, playerId: e.playerId } },
      update: { points: e.points, note: e.note ?? null, updatedAt: now },
      create: data,
    })
  }

  return getLive(round)
}

export async function resetLive(round: number): Promise<void> {
  await db.liveEntry.deleteMany({ where: { round } })
  await db.liveRound.deleteMany({ where: { round } })
}

// ── Édition manuelle : effectifs, transferts, scores ──────────
export interface SquadSlotInput {
  playerId: string
  role: 'TITULAIRE' | 'BANC'
  captain?: boolean
}

export async function saveSquad(managerId: string, slots: SquadSlotInput[]): Promise<void> {
  if (slots.length !== RULES.squadSize) throw new Error(`L’effectif doit compter ${RULES.squadSize} joueurs`)
  const ids = slots.map((s) => s.playerId)
  if (new Set(ids).size !== ids.length) throw new Error('Joueur en doublon dans l’effectif')
  const players = await db.player.findMany({ where: { id: { in: ids } } })
  const pMap = new Map(players.map((p) => [p.id, p]))
  if (players.length !== RULES.squadSize) throw new Error('Joueur inconnu dans l’effectif')

  const quota = { G: 0, D: 0, M: 0, A: 0 }
  for (const p of players) quota[p.position as Pos]++
  if (quota.G !== RULES.quota.G || quota.D !== RULES.quota.D || quota.M !== RULES.quota.M || quota.A !== RULES.quota.A) {
    throw new Error(`Composition invalide : il faut ${RULES.quota.G} G / ${RULES.quota.D} D / ${RULES.quota.M} M / ${RULES.quota.A} A`)
  }

  const starters = slots.filter((s) => s.role === 'TITULAIRE')
  if (starters.length !== 11) throw new Error('Le onze doit compter 11 titulaires')
  const captains = slots.filter((s) => s.captain)
  if (captains.length > 1) throw new Error('Un seul capitaine')
  if (captains.length === 1 && captains[0].role !== 'TITULAIRE') throw new Error('Le capitaine doit être titulaire')

  await db.$transaction(async (tx) => {
    await tx.squadSlot.deleteMany({ where: { managerId } })
    const round = (await getCurrentRound()) - 1
    for (const s of slots) {
      const p = pMap.get(s.playerId)!
      await tx.squadSlot.create({
        data: {
          managerId, playerId: s.playerId, role: s.role, slotPosition: p.position,
          captain: s.captain ?? false, round,
        },
      })
    }
  })
}

export interface TransferInput {
  managerId: string
  round: number
  outPlayerId?: string | null
  inPlayerId?: string | null
  note?: string | null
  applyToSquad?: boolean
}

export async function saveTransfer(input: TransferInput): Promise<void> {
  const { managerId, round, outPlayerId, inPlayerId, note } = input
  if (!Number.isInteger(round) || round < 1 || round > 38) throw new Error('Journée invalide')
  if (!outPlayerId && !inPlayerId) throw new Error('Choisis au moins un joueur')

  const squad = await db.squadSlot.findMany({ where: { managerId } })
  if (inPlayerId && squad.some((s) => s.playerId === inPlayerId)) throw new Error('Ce joueur est déjà dans l’effectif')
  if (outPlayerId && !squad.some((s) => s.playerId === outPlayerId)) throw new Error('Ce joueur n’est pas dans l’effectif')

  await db.$transaction(async (tx) => {
    await tx.transfer.create({
      data: {
        managerId, round, outPlayerId: outPlayerId ?? null, inPlayerId: inPlayerId ?? null,
        note: note ?? null, createdAt: new Date().toISOString(),
      },
    })

    if (input.applyToSquad !== false && outPlayerId && inPlayerId) {
      const outSlot = squad.find((s) => s.playerId === outPlayerId)!
      const inPlayer = await tx.player.findUnique({ where: { id: inPlayerId } })
      if (!inPlayer) throw new Error('Joueur entrant inconnu')
      if (inPlayer.position === outSlot.slotPosition) {
        // remplacement direct à poste identique
        await tx.squadSlot.update({
          where: { id: outSlot.id },
          data: { playerId: inPlayerId, captain: outSlot.captain && inPlayer.position === outSlot.slotPosition ? false : false },
        })
      } else {
        // poste différent : l'entrant va sur le banc, le sortant quitte l'effectif
        await tx.squadSlot.delete({ where: { id: outSlot.id } })
        await tx.squadSlot.create({
          data: {
            managerId, playerId: inPlayerId, role: 'BANC', slotPosition: inPlayer.position,
            captain: false, round: (await getCurrentRound()) - 1,
          },
        })
      }
    }
  })
}

export async function deleteTransfer(id: string): Promise<void> {
  await db.transfer.delete({ where: { id } })
}

export async function saveRoundScore(managerId: string, round: number, points: number | null): Promise<void> {
  if (!Number.isInteger(round) || round < 1 || round > 38) throw new Error('Journée invalide')
  const existing = await db.roundScore.findUnique({ where: { managerId_round: { managerId, round } } })
  if (existing) {
    await db.roundScore.update({ where: { managerId_round: { managerId, round } }, data: { points } })
  } else {
    await db.roundScore.create({ data: { managerId, round, points, source: 'SAISIE' } })
  }
  // recalcul des cumuls
  const scores = await db.roundScore.findMany({ where: { managerId }, orderBy: { round: 'asc' } })
  let acc = 0
  for (const s of scores) {
    acc += s.points ?? 0
    const totalAfter = s.points != null ? acc : null
    if (s.totalAfter !== totalAfter) {
      await db.roundScore.update({ where: { id: s.id }, data: { totalAfter } })
    }
  }
}

// ── Vue d'ensemble ────────────────────────────────────────────
export async function getOverview(): Promise<Overview> {
  const [league, team, captains, alerts] = await Promise.all([getLeague(), getTeam(), getCaptainPicks(), getAlerts()])
  const [playerCount, fixtureCount, CURRENT_ROUND] = await Promise.all([db.player.count(), db.fixture.count(), getCurrentRound()])
  return {
    leagueName: league.name,
    season: league.season,
    nextRound: CURRENT_ROUND,
    nextRoundDate: await getRoundDate(CURRENT_ROUND),
    myRank: league.myRank,
    myTotal: team.totals.total ?? 0,
    gapToLeader: league.gapToLeader,
    gapToLast: league.gapToLast,
    leaderName: league.leaderName,
    captainTop: captains[0] ?? null,
    alerts,
    squadSize: RULES.squadSize,
    playerCount,
    fixtureCount,
  }
}
