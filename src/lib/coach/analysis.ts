// ═══════════════════════════════════════════════════════════════
// ANALYSE — moteur statistique de l'assistant
// Calcule à partir des données en base (aucune invention) :
//  - prédiction de sélection (XI optimal + capitaine) pour J
//  - matrice capitaine multi-facteurs
//  - moteur de transferts OUT → IN chiffré
//  - comparaisons d'équipes contre chaque rival
//  - calendrier à venir avec difficultés
// ═══════════════════════════════════════════════════════════════
import { db } from '@/lib/db'
import {
  getCurrentRound, getLeague, getRoundDate, getTeam,
  difficultyFromLevel, easeBonus,
} from './engine'
import { getLastSync } from './fplsync'
import type { Difficulty, Pos, SquadPlayerView } from './types'

// ── Types du payload ───────────────────────────────────────────
export interface AnalysisPlayer {
  id: string
  name: string
  club: string
  position: Pos
  epNext: number | null
  form: number | null
  totalPoints: number | null
  minutes: number | null
  goals: number | null
  assists: number | null
  priceRef: number | null
  ownership: number | null
  status: 'DISPO' | 'DOUTEUX' | 'ABSENT'
  news: string | null
  fixturesNext: { round: number; label: string; difficulty: Difficulty }[]
  avgDiff3: number | null
  per90: number | null
  value: number | null // points par million
}

export interface PredictionXI {
  players: (AnalysisPlayer & { projected: number; captain: boolean })[]
  captain: { name: string; club: string; projected: number; fixture: string; difficulty: Difficulty } | null
  projectedLow: number
  projectedHigh: number
  formation: string
  risks: string[]
}

export interface CaptainRow {
  name: string
  club: string
  position: Pos
  fixture: string
  difficulty: Difficulty
  epNext: number | null
  form: number | null
  per90: number | null
  ownership: number | null
  score: number
  reasons: string[]
}

export interface TransferRec {
  out: { name: string; club: string; position: Pos; priceRef: number | null; reasons: string[]; score: number }
  in: { name: string; club: string; position: Pos; priceRef: number | null; epNext: number | null; form: number | null; ownership: number | null; reasons: string[]; score: number }
  gain: number
}

export interface RivalComparison {
  slug: string
  name: string
  squadSizeKnown: number
  squadValue: number | null
  xiProjected: number | null
  star: string | null
  positionEdges: { pos: Pos; mine: number | null; theirs: number | null }[]
  verdict: string
}

export interface AnalysisPayload {
  sync: { lastAt: string | null; currentRound: number; players: number; fixtures: number }
  round: number
  roundDate: string | null
  league: { myRank: number; myTotal: number | null; leaderName: string; gapToLeader: number; standings: { rank: number; name: string; total: number | null; isUser: boolean }[] }
  team: { formation: string; squadValue: number; bank: number; knownCount: number }
  prediction: PredictionXI | null
  captainMatrix: CaptainRow[]
  transfers: TransferRec[]
  comparisons: RivalComparison[]
  fixtures: { round: number; matches: { club: string; opponent: string; isHome: boolean; difficulty: Difficulty; kickoff: string | null }[] }[]
}

// ── Helpers ────────────────────────────────────────────────────
const fr = (n: number | null | undefined, d = 1) => (n == null ? '—' : n.toFixed(d).replace('.', ','))

function enrich(p: SquadPlayerView, fixtureMap: Map<string, { round: number; label: string; level: number }[]>): AnalysisPlayer {
  const fxs = fixtureMap.get(p.club) ?? []
  const avgDiff3 = fxs.length ? fxs.slice(0, 3).reduce((a, f) => a + f.level, 0) / Math.min(3, fxs.length) : null
  const mins = p.minutes ?? 0
  const ga = (p.goals ?? 0) + (p.assists ?? 0)
  return {
    id: p.id, name: p.name, club: p.club, position: p.position,
    epNext: p.epNext, form: p.form, totalPoints: p.totalPoints, minutes: p.minutes,
    goals: p.goals, assists: p.assists,
    priceRef: p.priceRef,
    ownership: null,
    status: p.status, news: p.news,
    fixturesNext: fxs.slice(0, 3).map((f) => ({ round: f.round, label: f.label, difficulty: f.level <= 2 ? 'FACILE' : f.level <= 3 ? 'MOYEN' : 'DIFFICILE' })),
    avgDiff3,
    per90: mins > 0 ? Math.round((ga / mins) * 90 * 100) / 100 : null,
    value: p.priceRef && p.priceRef > 0 && p.totalPoints != null ? Math.round((p.totalPoints / p.priceRef) * 100) / 100 : null,
  }
}

/** Projection J+1 pondérée (statuts et calendrier). */
function projectedOf(p: AnalysisPlayer): number {
  if (p.status === 'ABSENT') return 0
  let s = p.epNext ?? p.form ?? 0
  if (p.status === 'DOUTEUX') s -= 1.5
  if (p.avgDiff3 != null) s += p.avgDiff3 <= 2 ? 0.6 : p.avgDiff3 >= 4 ? -0.6 : 0
  return Math.max(0, Math.round(s * 10) / 10)
}

/** Meilleur XI légal (1G, D/M/A dans les quotas) maximisant la somme des projections — brute force C(15,11). */
function bestLineup(squad: AnalysisPlayer[]): { xi: AnalysisPlayer[]; formation: string } | null {
  if (squad.length !== 15) return null
  const n = squad.length
  let best: { xi: AnalysisPlayer[]; score: number } | null = null
  const idx = Array.from({ length: n }, (_, i) => i)
  const combos = (start: number, acc: number[]) => {
    if (acc.length === 11) {
      const picked = acc.map((i) => squad[i])
      const g = picked.filter((p) => p.position === 'G').length
      const d = picked.filter((p) => p.position === 'D').length
      const m = picked.filter((p) => p.position === 'M').length
      const a = picked.filter((p) => p.position === 'A').length
      if (g === 1 && d >= 3 && d <= 5 && m >= 2 && m <= 5 && a >= 1 && a <= 3) {
        const score = picked.reduce((s2, p) => s2 + projectedOf(p), 0)
        if (!best || score > best.score) best = { xi: picked, score }
      }
      return
    }
    for (let i = start; i < n; i++) combos(i + 1, [...acc, i])
  }
  combos(0, [])
  if (!best) return null
  const chosen = (best as { xi: AnalysisPlayer[] }).xi
  const d = chosen.filter((p) => p.position === 'D').length
  const m = chosen.filter((p) => p.position === 'M').length
  const a = chosen.filter((p) => p.position === 'A').length
  return { xi: chosen, formation: `${d}-${m}-${a}` }
}

// ── Analyse complète ───────────────────────────────────────────
export async function getAnalysis(): Promise<AnalysisPayload> {
  const CURRENT_ROUND = await getCurrentRound()
  const [team, league, lastSync, playerCount, fixtureCount] = await Promise.all([
    getTeam(), getLeague(), getLastSync(), db.player.count(), db.fixture.count(),
  ])

  // fixtures des 3 prochaines journées, indexées par club
  const fxRows = await db.fixture.findMany({
    where: { round: { gte: CURRENT_ROUND, lte: CURRENT_ROUND + 2 } },
    orderBy: [{ round: 'asc' }, { club: 'asc' }],
  })
  const fixtureMap = new Map<string, { round: number; label: string; level: number; difficulty: Difficulty; kickoff: string | null }[]>()
  for (const f of fxRows) {
    const arr = fixtureMap.get(f.club) ?? []
    if (!fixtureMap.has(f.club)) fixtureMap.set(f.club, arr)
    const dif = difficultyFromLevel(f.difficulty, f.opponent, f.isHome)
    arr.push({ round: f.round, label: `${f.isHome ? 'vs' : '@'} ${f.opponent}`, level: f.difficulty ?? 3, difficulty: dif, kickoff: f.kickoff })
  }

  const squad = [...team.starters, ...team.bench]
  const enriched = squad.map((p) => {
    const e = enrich(p, fixtureMap as Map<string, { round: number; label: string; level: number }[]>)
    e.ownership = p.ownership
    return e
  })

  const squadValue = Math.round(squad.reduce((a, p) => a + (p.priceRef ?? 0), 0) * 10) / 10
  const bank = Math.max(0, Math.round((100 - squadValue) * 10) / 10)

  // ── Prédiction de sélection ─────────────────────────────────
  let prediction: PredictionXI | null = null
  const lineup = bestLineup(enriched)
  if (lineup) {
    const order: Record<Pos, number> = { G: 0, D: 1, M: 2, A: 3 }
    const xi = [...lineup.xi].sort((a, b) => order[a.position] - order[b.position] || (b.epNext ?? 0) - (a.epNext ?? 0))
    const withProj = xi.map((p) => ({ ...p, projected: projectedOf(p) }))
    const capCandidate = withProj.filter((p) => p.status !== 'ABSENT').sort((a, b) => b.projected - a.projected)[0] ?? null
    const captain = capCandidate
      ? { name: capCandidate.name, club: capCandidate.club, projected: capCandidate.projected, fixture: capCandidate.fixturesNext[0]?.label ?? '—', difficulty: capCandidate.fixturesNext[0]?.difficulty ?? 'MOYEN' as Difficulty }
      : null
    const projectedLow = Math.round(withProj.reduce((a, p) => a + p.projected, 0) * 10) / 10
    const projectedHigh = Math.round((projectedLow + (capCandidate?.projected ?? 0)) * 10) / 10
    const risks: string[] = []
    for (const p of withProj) {
      if (p.status === 'ABSENT') risks.push(`${p.name} : absent${p.news ? ` (${p.news})` : ''}`)
      else if (p.status === 'DOUTEUX') risks.push(`${p.name} : incertain${p.news ? ` (${p.news})` : ''}`)
      else if (p.fixturesNext[0]?.difficulty === 'DIFFICILE') risks.push(`${p.name} : match difficile J${p.fixturesNext[0].round} (${p.fixturesNext[0].label})`)
    }
    prediction = {
      players: withProj.map((p) => ({ ...p, captain: p.id === (capCandidate?.id ?? '') })),
      captain,
      projectedLow,
      projectedHigh,
      formation: lineup.formation,
      risks: risks.slice(0, 5),
    }
  }

  // ── Matrice capitaine (top 6 de l'effectif) ─────────────────
  const captainMatrix: CaptainRow[] = enriched
    .filter((p) => p.status !== 'ABSENT')
    .map((p) => {
      const reasons: string[] = []
      let score = 0
      if (p.epNext != null) { score += p.epNext; reasons.push(`projection ${fr(p.epNext)} pt`) }
      if (p.form != null) { score += p.form * 0.4; reasons.push(`forme ${fr(p.form)}`) }
      if (p.per90 != null && p.per90 >= 0.5) { score += p.per90 * 0.3; reasons.push(`${fr(p.per90, 2)} but+passe par 90 min`) }
      const fx0 = p.fixturesNext[0]
      if (fx0) { score += easeBonus(fx0.difficulty); reasons.push(`J${fx0.round} ${fx0.label} — ${fx0.difficulty}`) }
      if (p.avgDiff3 != null && p.avgDiff3 <= 2) reasons.push(`calendrier favorable sur 3 journées (moy. ${fr(p.avgDiff3)})`)
      if (p.status === 'DOUTEUX') { score -= 2.5; reasons.push(p.news ? `incertitude : ${p.news}` : 'statut incertain') }
      if (p.ownership != null && p.ownership < 8) reasons.push(`differential (${fr(p.ownership)} % de détention)`)
      return {
        name: p.name, club: p.club, position: p.position,
        fixture: fx0 ? fx0.label : '—', difficulty: fx0?.difficulty ?? 'MOYEN',
        epNext: p.epNext, form: p.form, per90: p.per90, ownership: p.ownership,
        score: Math.round(score * 10) / 10, reasons,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  // ── Moteur de transferts ────────────────────────────────────
  const transfers: TransferRec[] = []
  const sellable = enriched
    .map((p) => {
      const reasons: string[] = []
      let s = 0
      if (p.status === 'ABSENT') { s += 3; reasons.push(`absent${p.news ? ` : ${p.news}` : ''}`) }
      else if (p.status === 'DOUTEUX') { s += 1.5; reasons.push(`incertain${p.news ? ` : ${p.news}` : ''}`) }
      if (p.minutes != null && p.totalPoints != null && p.minutes < 270 && p.totalPoints < 20) { s += 1.5; reasons.push(`temps de jeu faible (${p.minutes} min, ${p.totalPoints} pts)`) }
      if (p.form != null && p.form < 4) { s += 1; reasons.push(`forme faible (${fr(p.form)})`) }
      if (p.avgDiff3 != null && p.avgDiff3 >= 4) { s += 1; reasons.push(`calendrier difficile (moy. ${fr(p.avgDiff3)} sur 3 JD)`) }
      if (p.priceRef != null && p.totalPoints != null && p.priceRef >= 8 && p.totalPoints / p.priceRef < 4) { s += 0.5; reasons.push(`cher au regard du rendement (${fr(p.value, 2)} pt/M)`) }
      return { p, s, reasons }
    })
    .filter((x) => x.s >= 1.5 && x.reasons.length > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)

  const squadIds = new Set(squad.map((p) => p.id))
  for (const sell of sellable) {
    const outScore = (sell.p.epNext ?? 0) + (sell.p.avgDiff3 != null && sell.p.avgDiff3 <= 2 ? 0.6 : 0)
    const pool = await db.player.findMany({
      where: {
        position: sell.p.position, id: { notIn: [...squadIds] }, status: { not: 'ABSENT' },
        epNext: { not: null }, priceRef: { not: null, lte: (sell.p.priceRef ?? 0) + bank },
      },
      orderBy: { epNext: 'desc' },
      take: 25,
    })
    const buys = pool.map((q) => {
      const fxs = fixtureMap.get(q.club) ?? []
      const avgDiff3 = fxs.length ? fxs.slice(0, 3).reduce((a, f) => a + f.level, 0) / Math.min(3, fxs.length) : 3
      const mins = q.minutes ?? 0
      const per90 = mins > 0 ? ((q.goals ?? 0) + (q.assists ?? 0)) / mins * 90 : null
      const own = q.ownershipRef
      const s = (q.epNext ?? 0) + (avgDiff3 <= 2 ? 0.8 : avgDiff3 >= 4 ? -0.5 : 0) + (q.form ?? 0) * 0.3 + (per90 != null && per90 >= 0.5 ? 0.3 : 0) + (own != null && own < 10 ? 0.4 : 0)
      const reasons = [
        `projection ${fr(q.epNext)} pt vs ${fr(sell.p.epNext)} pour ${sell.p.name}`,
        `J${fxs[0]?.round ?? '?'} ${fxs[0]?.label ?? ''} — ${fxs[0]?.difficulty ?? 'MOYEN'}`,
        q.form != null ? `forme ${fr(q.form)}` : null,
        own != null ? `détenu par ${fr(own)} %` : null,
        q.priceRef != null ? `${fr(q.priceRef)} M (libère ${fr(Math.round(((sell.p.priceRef ?? 0) - q.priceRef) * 10) / 10)} M)` : null,
      ].filter(Boolean) as string[]
      return { q, s: Math.round(s * 10) / 10, reasons, avgDiff3 }
    })
    const best = buys.sort((a, b) => b.s - a.s)[0]
    if (best && best.s - outScore >= 0.5) {
      transfers.push({
        out: { name: sell.p.name, club: sell.p.club, position: sell.p.position, priceRef: sell.p.priceRef, reasons: sell.reasons, score: Math.round(outScore * 10) / 10 },
        in: { name: best.q.name, club: best.q.club, position: best.q.position as Pos, priceRef: best.q.priceRef, epNext: best.q.epNext, form: best.q.form, ownership: best.q.ownershipRef, reasons: best.reasons, score: best.s },
        gain: Math.round((best.s - outScore) * 10) / 10,
      })
    }
  }
  transfers.sort((a, b) => b.gain - a.gain)

  // ── Comparaisons d'équipes ──────────────────────────────────
  const managers = await db.manager.findMany({ include: { squads: { include: { player: true } } } })
  const myByPos = new Map<Pos, number[]>()
  for (const p of enriched) {
    if (p.epNext == null) continue
    const arr = myByPos.get(p.position) ?? []
    arr.push(p.epNext)
    myByPos.set(p.position, arr)
  }
  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null)

  const comparisons: RivalComparison[] = managers
    .filter((m) => !m.isUser)
    .map((m) => {
      const rows = m.squads.map((s) => ({ player: s.player, role: s.role }))
      const squadSizeKnown = rows.length
      const squadValue = rows.length ? Math.round(rows.reduce((a, r) => a + (r.player.priceRef ?? 0), 0) * 10) / 10 : null
      const xi = rows.filter((r) => r.role === 'TITULAIRE' && r.player.epNext != null)
      const xiProjected = xi.length ? Math.round(xi.reduce((a, r) => a + (r.player.epNext ?? 0), 0) * 10) / 10 : null
      const star = rows
        .filter((r) => r.player.epNext != null)
        .sort((a, b) => (b.player.epNext ?? 0) - (a.player.epNext ?? 0))[0]?.player.name ?? null
      const theirByPos = new Map<Pos, number[]>()
      for (const r of rows) {
        if (r.player.epNext == null) continue
        const pos = r.player.position as Pos
        const arr = theirByPos.get(pos) ?? []
        arr.push(r.player.epNext!)
        theirByPos.set(pos, arr)
      }
      const positionEdges = (['G', 'D', 'M', 'A'] as Pos[]).map((pos) => ({
        pos, mine: avg(myByPos.get(pos) ?? []), theirs: avg(theirByPos.get(pos) ?? []),
      }))
      const weakest = [...positionEdges].filter((e) => e.theirs != null).sort((a, b) => (a.theirs ?? 0) - (b.theirs ?? 0))[0]
      let verdict: string
      if (squadSizeKnown === 0) verdict = 'Effectif inconnu — à saisir dans la Ligue'
      else if (xiProjected == null) verdict = 'Onze partiel — compléter les titulaires pour comparer'
      else {
        const mine = prediction?.players.reduce((a, p) => a + p.projected, 0) ?? 0
        const diff = Math.round((mine - xiProjected) * 10) / 10
        if (diff > 5) verdict = `Tu devance son onze projeté de ${fr(diff)} pt`
        else if (diff < -5) verdict = `Son onze projette ${fr(Math.abs(diff))} pt de plus — viser sa ligne faible${weakest ? ` : ${weakest.pos === 'G' ? 'gardien' : weakest.pos === 'D' ? 'défense' : weakest.pos === 'M' ? 'milieu' : 'attaque'}` : ''}`
        else verdict = 'Onzes équivalents sur le papier — le capitaine fera la différence'
      }
      return { slug: m.slug, name: m.name, squadSizeKnown, squadValue, xiProjected, star, positionEdges, verdict }
    })
    .sort((a, b) => (b.xiProjected ?? -1) - (a.xiProjected ?? -1))

  // ── Calendrier 3 JD ─────────────────────────────────────────
  const fixtures = Array.from(new Set(fxRows.map((f) => f.round))).sort((a, b) => a - b).map((r) => ({
    round: r,
    matches: fxRows.filter((f) => f.round === r).map((f) => ({
      club: f.club, opponent: f.opponent, isHome: f.isHome,
      difficulty: difficultyFromLevel(f.difficulty, f.opponent, f.isHome), kickoff: f.kickoff,
    })),
  }))

  return {
    sync: { lastAt: lastSync?.at ?? null, currentRound: CURRENT_ROUND, players: playerCount, fixtures: fixtureCount },
    round: CURRENT_ROUND,
    roundDate: await getRoundDate(CURRENT_ROUND),
    league: {
      myRank: league.myRank, myTotal: league.standings.find((s) => s.isUser)?.total ?? null,
      leaderName: league.leaderName, gapToLeader: league.gapToLeader,
      standings: league.standings.map((s) => ({ rank: s.rank, name: s.name, total: s.total, isUser: s.isUser })),
    },
    team: { formation: team.formation, squadValue, bank, knownCount: team.knownPriceCount },
    prediction,
    captainMatrix,
    transfers,
    comparisons,
    fixtures,
  }
}

// ── Contexte de l'assistant IA (sérialisation de l'analyse) ────
const frCtx = (n: number | null | undefined, d = 1) => (n == null ? '—' : n.toFixed(d).replace('.', ','))

export async function getAssistantContext(): Promise<string> {
  const a = await getAnalysis()
  const pred = a.prediction

  const { db } = await import('@/lib/db')
  const { getLive } = await import('./engine')

  let liveBlock = ''
  const activeLive = await db.liveEntry.findFirst({ orderBy: { updatedAt: 'desc' } })
  if (activeLive) {
    const lv = await getLive(activeLive.round)
    const scored = lv.rows.filter((r) => r.points != null && r.role === 'TITULAIRE')
    liveBlock = `
JOURNÉE EN COURS (J${lv.round}${lv.roundDate ? `, ${lv.roundDate}` : ''}) :
- Score live : ${lv.live.liveRoundPoints} pts (titulaires ${lv.live.startersPoints} + bonus capitaine ${lv.live.captainBonus}, ×${lv.multiplier})
- Total projeté : ${lv.live.projectedTotal} (base ${lv.live.baseTotal})
- Classement projeté : ${lv.standings.map((s) => `${s.rank}. ${s.name} ${s.projectedTotal ?? '?'}`).join(' | ')}
- Points déjà saisis : ${scored.map((r) => `${r.name} ${r.points}`).join(', ') || 'aucun'}
`
  }

  const classement = a.league.standings
    .map((r) => `${r.rank}. ${r.name} — ${r.total ?? '?'} pts${r.isUser ? ' ← TOI' : ''}`)
    .join('\n')

  const xiStr = pred
    ? pred.players
        .map((p) => `- ${p.name} (${p.club}, ${p.position}) proj. ${frCtx(p.projected)} pt${p.captain ? ' [CAPITAINE prédit]' : ''} — ${p.fixturesNext[0]?.label ?? '—'} (${p.fixturesNext[0]?.difficulty ?? '—'})`)
        .join('\n')
    : 'effectif incomplet'

  const capStr = a.captainMatrix
    .slice(0, 5)
    .map((c, i) => `${i + 1}. ${c.name} (${c.club}) — score ${frCtx(c.score)} — ${c.fixture} — ${c.reasons.join(' ; ')}`)
    .join('\n')

  const transfersStr = a.transfers.length
    ? a.transfers
        .map((t) => `• SORT : ${t.out.name} (${t.out.club}, ${frCtx(t.out.priceRef)} M) — ${t.out.reasons.join(' ; ')}\n  ENTRÉE : ${t.in.name} (${t.in.club}, ${frCtx(t.in.priceRef)} M, proj. ${frCtx(t.in.epNext)}, détention ${frCtx(t.in.ownership)} %) — gain estimé ${frCtx(t.gain)} pt`)
        .join('\n')
    : 'aucun transfert prioritaire détecté'

  const rivalsStr = a.comparisons
    .map((c) => `- ${c.name} : effectif ${c.squadValue != null ? `${frCtx(c.squadValue)} M` : '?'}, onze projeté ${c.xiProjected != null ? `${frCtx(c.xiProjected)} pt` : 'incomplet'}, star : ${c.star ?? '?'} — ${c.verdict}`)
    .join('\n')

  const fixtureStr = a.fixtures
    .map((r) => `J${r.round} : ${r.matches.slice(0, 10).map((f) => `${f.club} ${f.isHome ? 'vs' : '@'} ${f.opponent}`).join(' | ')}`)
    .join('\n')

  return `Tu es l'analyste fantasy personnel de l'utilisateur (équipe VITAL_GDB) dans sa ligue privée Sofascore Fantasy Premier League 2026/27 « Le fond de la classe » (5 gestionnaires). Tu parles français, ton style est direct, chiffré, sans flatterie.

RÈGLES 2026/27 : budget 100 M, 15 joueurs (2G/5D/5M/3A), 2 transferts gratuits/journée (cumul max 5, au-delà −5 pts), capitaine ×2, tokens : Triple Captain ×3 (1/saison), Quick Fix (2), Rebuild Squad (2), max 1 token/journée.

SYNCHRO : dernières données officielles du ${a.sync.lastAt ? new Date(a.sync.lastAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'jamais'} · ${a.sync.players} joueurs · ${a.sync.fixtures} lignes calendrier.
${liveBlock}
CLASSEMENT :
${classement}

TA SITUATION : ${a.league.myRank}${a.league.myRank === 1 ? 'er' : 'e'} avec ${a.league.myTotal ?? '?'} pts, écart leader ${a.league.gapToLeader} (${a.league.leaderName}). Valeur effectif ${frCtx(a.team.squadValue)} M, banque ~${frCtx(a.team.bank)} M.

SÉLECTION PRÉDITE J${a.round} (moteur statistique, formation ${pred?.formation ?? '?'}):
${xiStr}
Projection totale : ${pred ? `${frCtx(pred.projectedLow)} à ${frCtx(pred.projectedHigh)} pts` : '—'}
Risques : ${pred?.risks.join(' ; ') || 'aucun'}

MATRICE CAPITAINE J${a.round} :
${capStr}

MOTEUR DE TRANSFERTS :
${transfersStr}

COMPARAISONS RIVAUX :
${rivalsStr}

CALENDRIER (3 prochaines journées complètes) :
${fixtureStr}

CONSIGNE : n'invente AUCUN chiffre — utilise uniquement ceux du contexte. Si une donnée manque, dis-le. Réponds en français, direct et actionnable (max ~180 mots), sans emoji. Donne toujours ta recommandation avec les raisons chiffrées.`
}
