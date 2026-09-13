// ═══════════════════════════════════════════════════════════════
// MOTEUR COACH — Sofascore Fantasy Premier League 2026/27
// Ligue privée réelle « Le fond de la classe » (5 managers)
//
// PRINCIPE ABSOLU : ZÉRO DONNÉE INVENTÉE.
// - Points  → captures réelles de l'app (13 sept 2026)
// - Prix/%  → article officiel Sofascore « Picks R4 » (11 sept 2026)
// - Fixtures→ article officiel « Best fixture runs R4-8 »
// - Règles  → article officiel « What's New 2026/27 » (28 août 2026)
// Tout le reste = null → affiché « à confirmer », jamais fabriqué.
// ═══════════════════════════════════════════════════════════════
import { db } from '@/lib/db'
import type {
  Alert, CaptainPick, Difficulty, FixtureLite, FixtureView, LeagueView,
  MarketTarget, Overview, Pos, SquadPlayerView, StandingRow, TeamView,
  TransferFlag,
} from './types'

// ── Règles officielles vérifiées (ARTICLE-NOUVEAUTES-2627) ──────
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
  scoringNote:
    'Points basés sur les ratings Sofascore + 30+ catégories. Changements 2026/27 : dégagements 6 = 1 pt, les passes ne marquent plus pour les défenseurs, pénalité pertes de balle dès 4, dribbles 3 = 1 pt, seuils GK (arrêts/dégagements) 3.',
} as const

// Dates officielles des prochaines journées (capture app 13 sept)
export const ROUND_DATES: Record<number, string> = {
  5: '18 sept. 2026',
  6: '10 oct. 2026',
  7: '17 oct. 2026',
  8: '23 oct. 2026',
}

// Clubs promus — Leeds & Hull cités comme promus dans l'article officiel ;
// Coventry déduit des fixtures publiées (à confirmer).
const PROMOTED_OFFICIAL = new Set(['Leeds United', 'Hull City'])
const PROMOTED_DEDUCE = new Set(['Coventry City'])
// Clubs forts (top du jeu selon l'article : Arsenal, City, Chelsea, Newcastle, Liverpool)
const STRONG = new Set(['Arsenal', 'Manchester City', 'Liverpool', 'Chelsea', 'Newcastle United'])
// Clubs dont les fixtures R4-R8 sont publiées officiellement
const TRACKED = new Set(['Arsenal', 'Manchester City', 'Chelsea', 'Newcastle United', 'Liverpool'])

// ── Difficulté de fixture — heuristique TRANSPARENTE ───────────
// Facteurs (affichés à l'utilisateur) : domicile, adversaire promu,
// adversaire fort, série officiellement clémente du club.
function fixtureDifficulty(club: string, opponent: string, isHome: boolean): { difficulty: Difficulty; note: string } {
  if (!TRACKED.has(club)) return { difficulty: 'INCONNU', note: 'Fixture non publiée dans l’article officiel R4-8' }
  let ease = 0
  const factors: string[] = []
  if (isHome) { ease += 1; factors.push('à domicile') }
  else { factors.push('à l’extérieur') }
  if (PROMOTED_OFFICIAL.has(opponent)) { ease += 1.5; factors.push(`adversaire promu (${opponent})`) }
  else if (PROMOTED_DEDUCE.has(opponent)) { ease += 1.25; factors.push(`adversaire promu (${opponent}, déduit des fixtures)`) }
  if (STRONG.has(opponent)) { ease -= 1; factors.push(`adversaire fort (${opponent})`) }
  if (TRACKED.has(club)) { ease += 0.5; factors.push('série R4-8 officiellement parmi les 5 plus clémentes (article)') }
  const difficulty: Difficulty = ease >= 1.5 ? 'FACILE' : ease >= 0.5 ? 'MOYEN' : 'DIFFICILE'
  return { difficulty, note: factors.join(' · ') }
}

const easeBonus = (d: Difficulty) => (d === 'FACILE' ? 2 : d === 'MOYEN' ? 1 : 0)

const fixtureLabel = (f: { opponent: string; isHome: boolean }) => `${f.isHome ? 'vs' : '@'} ${f.opponent}`

// ── Mon équipe réelle ──────────────────────────────────────────
export async function getTeam(): Promise<TeamView> {
  const slots = await db.squadSlot.findMany({
    include: { player: true },
    orderBy: [{ role: 'asc' }, { slotPosition: 'asc' }],
  })
  const fixturesR5 = await db.fixture.findMany({ where: { round: 5 } })
  const fixMap = new Map(fixturesR5.map((f) => [f.club, f]))

  const view = (s: (typeof slots)[number]): SquadPlayerView => {
    const fx = s.player.clubConfirmed ? fixMap.get(s.player.club) : undefined
    let fixtureR5: FixtureLite | null = null
    if (fx) {
      const { difficulty, note } = fixtureDifficulty(fx.club, fx.opponent, fx.isHome)
      fixtureR5 = { opponent: fx.opponent, isHome: fx.isHome, difficulty, note }
    }
    return {
      id: s.player.id,
      name: s.player.name,
      club: s.player.club,
      clubConfirmed: s.player.clubConfirmed,
      position: s.slotPosition as Pos,
      role: s.role as 'TITULAIRE' | 'BANC',
      captain: s.captain,
      pointsR4: s.pointsR4,
      pointsNote: s.pointsNote,
      price: s.player.price,
      ownership: s.player.ownership,
      priceSource: s.player.priceSource,
      formNote: s.player.formNote,
      fixtureR5,
    }
  }

  const starters = slots.filter((s) => s.role === 'TITULAIRE').map(view)
  const bench = slots.filter((s) => s.role === 'BANC').map(view)

  const byPos = (arr: SquadPlayerView[]) => {
    const g = arr.filter((p) => p.position === 'G').length
    const d = arr.filter((p) => p.position === 'D').length
    const m = arr.filter((p) => p.position === 'M').length
    const a = arr.filter((p) => p.position === 'A').length
    return [g, d, m, a]
  }
  const [, d, m, a] = byPos(starters)
  const formation = `${d}-${m}-${a}`

  const priced = [...starters, ...bench].filter((p) => p.price != null)
  const knownSpend = priced.reduce((acc, p) => acc + (p.price ?? 0), 0)
  const unknown = [...starters, ...bench].filter((p) => p.price == null).map((p) => p.name)

  const scores = await db.roundScore.findMany({ include: { manager: true }, orderBy: { round: 'asc' } })
  const mine = scores.filter((s) => s.manager.isUser && s.points != null)
  const at = (r: number) => mine.find((s) => s.round === r)?.points ?? 0
  const totals = {
    r1: at(1), r2: at(2), r3: at(3), r4: at(4),
    total: mine.find((s) => s.round === 4)?.totalAfter ?? mine.reduce((acc, s) => acc + (s.points ?? 0), 0),
  }

  return {
    formation,
    starters,
    bench,
    knownSpend: Math.round(knownSpend * 10) / 10,
    knownPriceCount: priced.length,
    unknownPriceCount: unknown,
    totals,
  }
}

// ── Capitaine R5 — classement transparent ─────────────────────
export async function getCaptainPicks(team?: TeamView): Promise<CaptainPick[]> {
  const t = team ?? (await getTeam())
  const picks: Omit<CaptainPick, 'rank'>[] = []
  for (const p of t.starters) {
    if (!p.fixtureR5 || p.fixtureR5.difficulty === 'INCONNU') continue
    const reasons: string[] = []
    let score = 0
    if (p.pointsR4 != null) {
      score += p.pointsR4
      reasons.push(`${p.pointsR4} pts réels en R4 (capture)`)
    } else if (p.pointsNote) {
      reasons.push(`points R4 incomplets : ${p.pointsNote}`)
    }
    if (p.formNote) {
      score += 1
      reasons.push(`forme officielle : ${p.formNote}`)
    }
    if (p.captain) {
      score += 0.5
      reasons.push('capitaine sortant (R4)')
    }
    score += easeBonus(p.fixtureR5.difficulty)
    reasons.push(`R5 ${fixtureLabel(p.fixtureR5)} — ${p.fixtureR5.difficulty} (${p.fixtureR5.note})`)
    if (p.ownership != null) reasons.push(`détenu par ${p.ownership}% du jeu (article officiel)`)
    picks.push({
      playerId: p.id, name: p.name, club: p.club, position: p.position,
      fixture: fixtureLabel(p.fixtureR5), difficulty: p.fixtureR5.difficulty,
      score: Math.round(score * 10) / 10, reasons,
    })
  }
  picks.sort((x, y) => y.score - x.score)
  return picks.map((p, i) => ({ ...p, rank: i + 1 }))
}

// ── Vigilance effectif (signaux 100% réels) ───────────────────
export async function getTransferFlags(): Promise<TransferFlag[]> {
  const t = await getTeam()
  const all = [...t.starters, ...t.bench]
  const by = (n: string) => all.find((p) => p.name === n)
  const flags: TransferFlag[] = []
  const push = (name: string, kind: TransferFlag['kind'], reason: string, source: string) => {
    const p = by(name)
    if (p) flags.push({ playerId: p.id, name, kind, reason, source })
  }
  push('Abdukodir Khusanov', 'SURVEILLER', '0 pt en R4, pas entré en jeu lors du derby — risque de rotation à clarifier avant la clôture R5.', 'Capture 13 sept')
  push('James Justin', 'DOUTE', 'Points R4 non comptés à la capture (match vs Newcastle pas encore joué) — vérifie son statut et son score final.', 'Capture 13 sept')
  push('Yoane Wissa', 'DOUTE', 'Match vs Leeds en direct à la capture — ses points R4 finaux sont à vérifier dans l’app.', 'Capture 13 sept')
  push('Bruno Fernandes', 'SURVEILLER', 'Seulement 4 pts lors du derby perdu 0-1 — surveille la forme de Man United sur R5-R6.', 'Capture 13 sept + résultat vérifié')
  push('John Egan', 'GARDER', '1 pt en R4 mais cité officiellement parmi les défenseurs en forme du jeu ; la défense de Hull (avec Ajayi) est la défense budget en forme. 4,2 M€, 2,5 % détention : profil différentiel à conserver.', 'Article officiel Picks R4')
  return flags
}

// ── Cibles marché (prix 100% sourcés article officiel) ────────
export async function getMarketTargets(): Promise<MarketTarget[]> {
  const t = await getTeam()
  const squadIds = new Set([...t.starters, ...t.bench].map((p) => p.id))
  const players = await db.player.findMany({ where: { price: { not: null } } })
  const fixturesR5 = new Map((await db.fixture.findMany({ where: { round: 5 } })).map((f) => [f.club, f]))
  const targets = players
    .filter((p) => !squadIds.has(p.id))
    .map((p) => {
      const fx = p.clubConfirmed ? fixturesR5.get(p.club) : undefined
      const dif = fx ? fixtureDifficulty(fx.club, fx.opponent, fx.isHome) : null
      let rationale = ''
      if (fx && dif) rationale = `R5 ${fixtureLabel({ opponent: fx.opponent, isHome: fx.isHome })} — ${dif.difficulty}`
      else rationale = 'Fixture R5 non publiée'
      return {
        playerId: p.id, name: p.name, club: p.club, position: p.position as Pos,
        price: p.price as number, ownership: p.ownership ?? 0, formNote: p.formNote, rationale,
      }
    })
  const rankOrder = ['FACILE', 'MOYEN', 'DIFFICILE', 'INCONNU']
  targets.sort((a, b) => {
    const da = rankOrder.indexOf(a.rationale.split(' — ')[1]?.split(' ')[0] ?? 'INCONNU')
    const dbv = rankOrder.indexOf(b.rationale.split(' — ')[1]?.split(' ')[0] ?? 'INCONNU')
    return da - dbv || b.ownership - a.ownership
  })
  return targets
}

// ── Alertes (faits réels uniquement) ──────────────────────────
export async function getAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [
    {
      level: 'HOT',
      title: 'nik Leroy a frappé fort en R4',
      detail: '108 pts pour nik Leroy contre 71 pour toi cette journée : −37 pts d’écart en une seule journée. C’est le seul score rival individuel connu pour l’instant.',
      source: 'Capture classement 13 sept 21:22',
    },
    {
      level: 'WARN',
      title: '2 points R4 encore incertains dans ton XI',
      detail: 'Justin (match vs Newcastle pas joué à la capture) et Wissa (match vs Leeds en direct) : vérifie leurs points finaux R4 dans l’app et envoie la correction si besoin.',
      source: 'Capture équipe 13 sept 21:45',
    },
    {
      level: 'WARN',
      title: 'Khusanov : 0 pt, pas entré en jeu au derby',
      detail: 'Risque de rotation City à clarifier. Sa fixture R5 (vs Sunderland à domicile si le club est confirmé) reste favorable — pas de vente paniquée, mais surveille les compositions.',
      source: 'Capture équipe 13 sept + derby vérifié',
    },
    {
      level: 'INFO',
      title: 'R5 — 18 septembre : 2 transferts gratuits',
      detail: 'Règle officielle 2026/27 : 2 transferts gratuits par journée, cumulables jusqu’à 5. Au-delà : −5 pts par transfert supplémentaire. Tokens : max 1 par journée.',
      source: 'Article officiel What’s New 2026/27',
    },
    {
      level: 'INFO',
      title: 'Budget : 44,3 M€ confirmés, 9 prix à confirmer',
      detail: '6 de tes 15 joueurs ont un prix sourcé officiellement (44,3 M€). Pour les 9 autres, vérifie ton budget réel et tes valeurs dans l’app avant tout transfert — aucun prix n’est inventé ici.',
      source: 'Article officiel + capture équipe',
    },
    {
      level: 'INFO',
      title: 'Ta marge sur la 5e place : 1 point',
      detail: 'Zarés JR est à 283, toi à 284. La lutte pour ne pas finir dernier se joue à rien — chaque journée compte.',
      source: 'Capture classement 13 sept 21:22',
    },
  ]
  return alerts
}

// ── Ligue réelle ──────────────────────────────────────────────
export async function getLeague(): Promise<LeagueView> {
  const managers = await db.manager.findMany({ orderBy: { sortOrder: 'asc' }, include: { scores: true } })
  const rows: StandingRow[] = managers.map((m) => {
    const total = m.scores.find((s) => s.round === 4)?.totalAfter ?? null
    const r4 = m.scores.find((s) => s.round === 4)?.points ?? null
    const historyKnown = m.scores.filter((s) => s.points != null).length > 1
    return {
      rank: 0, name: m.name, isUser: m.isUser, total, r4,
      r4Known: r4 != null, historyKnown,
    }
  })
  rows.sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
  rows.forEach((r, i) => { r.rank = i + 1 })
  const me = rows.find((r) => r.isUser)!
  const leader = rows[0]
  const last = rows[rows.length - 1]
  return {
    name: 'Le fond de la classe',
    season: '2026/27',
    standings: rows,
    myRank: me.rank,
    gapToLeader: (me.total ?? 0) - (leader.total ?? 0),
    gapToLast: (me.total ?? 0) - (last.total ?? 0),
    leaderName: leader.name,
    averageR4Displayed: 64.1,
    bestR4Displayed: 141,
    missingData: [
      'Scores journée par journée de nik Leroy, Donatien_10, Aziza FC et Zarés JR (R1→R3)',
      'Compositions des 4 rivaux (captures de leur XI si l’app le permet)',
      'Scores R4 individuels de Donatien_10, Aziza FC et Zarés JR',
    ],
  }
}

// ── Fixtures R5→R8 ────────────────────────────────────────────
export async function getFixtures(): Promise<{ rounds: Record<number, FixtureView[]>; officialRuns: string }> {
  const fixtures = await db.fixture.findMany({ where: { round: { gte: 5 } }, orderBy: [{ round: 'asc' }, { club: 'asc' }] })
  const rounds: Record<number, FixtureView[]> = {}
  for (const f of fixtures) {
    const { difficulty, note } = fixtureDifficulty(f.club, f.opponent, f.isHome)
    const arr = (rounds[f.round] ??= [])
    arr.push({ round: f.round, club: f.club, opponent: f.opponent, isHome: f.isHome, difficulty, note })
  }
  return {
    rounds,
    officialRuns:
      'Classement officiel des séries R4-8 (article Sofascore) : 1. Arsenal (le plus clément de très loin) · 2. Manchester City · 3. Chelsea · 4. Newcastle · 5. Liverpool.',
  }
}

// ── Vue d'ensemble ────────────────────────────────────────────
export async function getOverview(): Promise<Overview> {
  const [league, team, captains, alerts] = await Promise.all([getLeague(), getTeam(), getCaptainPicks(), getAlerts()])
  const [playersTracked, pricesSourced, fixturesSourced, dataEvents] = await Promise.all([
    db.player.count(),
    db.player.count({ where: { price: { not: null } } }),
    db.fixture.count(),
    db.dataEvent.count(),
  ])
  return {
    leagueName: league.name,
    game: 'Sofascore Fantasy Premier League',
    season: '2026/27',
    nextRound: 5,
    nextRoundDate: ROUND_DATES[5],
    myRank: league.myRank,
    myTotal: team.totals.total,
    gapToLeader: league.gapToLeader,
    gapToLast: league.gapToLast,
    leaderName: league.leaderName,
    captainTop: captains[0] ?? null,
    alerts: alerts.slice(0, 4),
    budget: {
      knownSpend: team.knownSpend,
      knownCount: team.knownPriceCount,
      unknownCount: team.unknownPriceCount.length,
    },
    dataQuality: { playersTracked, pricesSourced, fixturesSourced, dataEvents },
  }
}

// ── Contexte de l'assistant IA (données réelles compactes) ────
export async function getAssistantContext(): Promise<string> {
  const [league, team, captains, flags, targets, alerts, fixtures] = await Promise.all([
    getLeague(), getTeam(), getCaptainPicks(), getTransferFlags(), getMarketTargets(), getAlerts(), getFixtures(),
  ])
  const xi = team.starters
    .map((p) => {
      const pts = p.pointsR4 != null ? `${p.pointsR4} pts` : `points incomplets (${p.pointsNote ?? 'match non joué à la capture'})`
      const prix = p.price != null ? `${p.price}M€` : 'prix à confirmer'
      const fx = p.fixtureR5 ? `R5 ${p.fixtureR5.isHome ? 'vs' : '@'} ${p.fixtureR5.opponent} (${p.fixtureR5.difficulty})` : 'fixture R5 inconnue'
      return `- ${p.name} (${p.club}${p.clubConfirmed ? '' : ', club à confirmer'}, ${p.position}, ${prix}) — R4 : ${pts}${p.captain ? ' [C]' : ''} — ${fx}`
    })
    .join('\n')
  const bench = team.bench
    .map((p) => `${p.name} (${p.club}, ${p.position}${p.price != null ? `, ${p.price}M€` : ''}) : ${p.pointsR4 ?? 'incomplet'}`)
    .join(', ')
  const classement = league.standings
    .map((r) => `${r.rank}. ${r.name} ${r.total ?? '?'} pts${r.r4 != null ? ` (R4 : ${r.r4})` : ' (R4 individuel à confirmer)'}${r.isUser ? ' ← TOI' : ''}`)
    .join('\n')
  const cap = captains.slice(0, 4).map((c) => `${c.rank}. ${c.name} — ${c.fixture} — score ${c.score} (${c.reasons.join(' ; ')})`).join('\n')
  const flagStr = flags.map((f) => `${f.kind} : ${f.name} — ${f.reason}`).join('\n')
  const targetStr = targets.slice(0, 6).map((t) => `${t.name} (${t.club}, ${t.position}, ${t.price}M€, ${t.ownership}%) — ${t.rationale}${t.formNote ? ` — ${t.formNote}` : ''}`).join('\n')
  const fixtureStr = Object.entries(fixtures.rounds)
    .map(([r, arr]) => `R${r} : ${arr.map((f) => `${f.club} ${f.isHome ? 'vs' : '@'} ${f.opponent} [${f.difficulty}]`).join(' | ')}`)
    .join('\n')

  return `Tu es le coach fantasy personnel de l'utilisateur (équipe VITAL_GDB) dans sa VRAIE ligue privée Sofascore Fantasy Premier League 2026/27 « Le fond de la classe » (5 gestionnaires). Toutes les données ci-dessous sont RÉELLES et sourcées (captures de son app Sofascore du 13/09/2026 + articles officiels Sofascore).

RÈGLES EN VIGUEUR (officielles 2026/27) : budget 100 M€, 15 joueurs (2G/5D/5M/3A), 2 transferts gratuits/journée (cumul max 5, au-delà −5 pts), capitaine ×2, tokens : Triple Captain ×3 (1/saison), Quick Fix (2/saison), Rebuild Squad (2/saison, 1 par mi-saison), max 1 token/journée. Scoring : ratings Sofascore + 30+ catégories.

CLASSEMENT RÉEL après R4 :
${classement}
Moyenne R4 affichée dans l'app : 64,1 · meilleur score affiché : 141 (probablement global, à confirmer).

TON XI RÉEL (points R4 de la capture, formation ${team.formation}) :
${xi}
BANC : ${bench}
Budget confirmé : ${team.knownSpend} M€ sur ${team.knownPriceCount} joueurs ; prix à confirmer pour : ${team.unknownPriceCount.join(', ')}.

FIXTURES OFFICIELLES (article Sofascore) :
${fixtureStr}
${fixtures.officialRuns}
Dates : R5 18 sept · R6 10 oct · R7 17 oct · R8 23 oct.

SUGGESTIONS CAPITAINE R5 (moteur, transparent) :
${cap}

VIGILANCE EFFECTIF :
${flagStr}

CIBLES MARCHÉ SOURCÉES (prix officiels) :
${targetStr}

ALERTES RÉELLES :
${alerts.map((a) => `- [${a.level}] ${a.title} : ${a.detail}`).join('\n')}

DONNÉES MANQUANTES (dire « à confirmer » si l'utilisateur demande dessus, ne JAMAIS inventer) :
${league.missingData.map((m) => `- ${m}`).join('\n')}
- Compositions des rivaux (l'app Sofascore est derrière une connexion : l'utilisateur enverra des captures)

CONSIGNE ABSOLUE : n'invente AUCUN chiffre (prix, points, %, fixtures). Si une donnée manque, dis explicitement « à confirmer » et propose de la vérifier via une capture. Réponds en français, direct et actionnable (max ~180 mots), emojis avec parcimonie (🟢🟡🔴🧢💎). Donne toujours ta recommandation + les raisons sourcées.`
}
