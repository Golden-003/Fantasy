// ═══════════════════════════════════════════════════════════════
// ANALYSTE RULE-BASED — répond aux questions avec les VRAIES données
// de la base (Sofascore SSR + fantasy). Utilisé en repli lorsque le
// modèle de langage n'est pas disponible (ex. Vercel sans SDK).
// Zéro invention : chaque chiffre vient de la base.
// Perf : requêtes légères pour la plupart des intentions ;
// getAnalysis() (coûteux) n'est appelé que si nécessaire.
// ═══════════════════════════════════════════════════════════════
import { db } from '@/lib/db'
import { getCurrentRound, getLeague } from './engine'
import type { AnalysisPayload } from './analysis'

export interface AnalystResult {
  reply: string
  intent: string
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ')

const has = (m: string, ...words: string[]) => words.some((w) => m.includes(w))
const fr = (n: number | null | undefined, d = 1) => (n == null ? '—' : n.toFixed(d).replace('.', ','))

const CLUB_ALIASES: Record<string, string> = {
  arsenal: 'Arsenal', gunners: 'Arsenal',
  chelsea: 'Chelsea', blues: 'Chelsea',
  liverpool: 'Liverpool', reds: 'Liverpool',
  'man city': 'Man City', city: 'Man City', 'manchester city': 'Man City', citizens: 'Man City',
  'man utd': 'Man Utd', united: 'Man Utd', 'manchester united': 'Man Utd', 'red devils': 'Man Utd',
  tottenham: 'Spurs', spurs: 'Spurs', hotspur: 'Spurs',
  newcastle: 'Newcastle', magpies: 'Newcastle',
  'aston villa': 'Aston Villa', villa: 'Aston Villa',
  brighton: 'Brighton', seagulls: 'Brighton',
  'west ham': 'West Ham', hammers: 'West Ham',
  everton: 'Everton', toffees: 'Everton',
  brentford: 'Brentford', bees: 'Brentford',
  fulham: 'Fulham', cottagers: 'Fulham',
  bournemouth: 'Bournemouth', cherries: 'Bournemouth',
  'crystal palace': 'Crystal Palace', palace: 'Crystal Palace',
  leeds: 'Leeds', 'leeds united': 'Leeds',
  sunderland: 'Sunderland', 'black cats': 'Sunderland',
  burnley: 'Burnley', clarets: 'Burnley',
  wolves: 'Wolves', wolverhampton: 'Wolves',
  "nott'm forest": "Nott'm Forest", nottm: "Nott'm Forest", forest: "Nott'm Forest",
  nottingham: "Nott'm Forest", 'nottingham forest': "Nott'm Forest",
  ipswich: 'Ipswich Town', 'ipswich town': 'Ipswich Town', 'tractor boys': 'Ipswich Town',
  'hull city': 'Hull City', hull: 'Hull City', tigers: 'Hull City',
  'coventry city': 'Coventry City', coventry: 'Coventry City', 'sky blues': 'Coventry City',
}

export async function analystAnswer(message: string): Promise<AnalystResult> {
  const m = norm(message)
  const sections: string[] = []
  const intents: string[] = []
  const round = await getCurrentRound()

  // Analyse lourde : chargée seulement si une intention la nécessite
  let analysis: AnalysisPayload | null = null
  const getA = async () => {
    if (!analysis) {
      const { getAnalysis } = await import('./analysis')
      analysis = await getAnalysis()
    }
    return analysis
  }

  // ── Recherche d'un joueur par nom (le plus spécifique d'abord) ──
  const playerHit = await findPlayer(m)
  const clubHit = findClub(m)
  const roundMatch = m.match(/\bj(?:ournee|ourne)?\s*0*(\d{1,2})\b/)

  if (playerHit) {
    intents.push('joueur')
    sections.push(await playerCard(playerHit, round))
  }

  if (has(m, 'buteur', 'marqueur', 'scorer', 'meilleur attaquant', 'top scorer', 'meilleurs buteurs')) {
    intents.push('buteurs')
    const top = await db.player.findMany({
      where: { goals: { gt: 0 } }, orderBy: [{ goals: 'desc' }, { assists: 'desc' }], take: 8,
      select: { name: true, club: true, goals: true, assists: true, marketValue: true },
    })
    sections.push(
      '⚽ TOP BUTEURS PL (réels Sofascore) :\n' +
        top.map((p, i) => `${i + 1}. ${p.name} (${p.club}) — ${p.goals} buts${p.assists ? ` + ${p.assists} passes` : ''}${p.marketValue ? ` — ${(Number(p.marketValue) / 1e6).toFixed(0)} M€` : ''}`).join('\n'),
    )
  }
  if (has(m, 'passe decis', 'passeur', 'assist')) {
    intents.push('passeurs')
    const top = await db.player.findMany({
      where: { assists: { gt: 0 } }, orderBy: [{ assists: 'desc' }, { goals: 'desc' }], take: 6,
      select: { name: true, club: true, assists: true, goals: true },
    })
    sections.push(
      '🎯 TOP PASSEURS PL (réels) :\n' +
        top.map((p, i) => `${i + 1}. ${p.name} (${p.club}) — ${p.assists} passes${p.goals ? ` + ${p.goals} buts` : ''}`).join('\n'),
    )
  }

  if (has(m, 'classement', 'standing', 'qui est premier', 'leader')) {
    intents.push('classement')
    const pl = await db.teamStanding.findMany({ orderBy: { position: 'asc' }, take: 8 })
    const lg = await getLeague()
    sections.push(
      '🏆 CLASSEMENT PREMIER LEAGUE (officiel Sofascore) :\n' +
        pl.map((t) => `${t.position}. ${t.club} — ${t.points} pts (${t.played}J, ${t.wins}V ${t.draws}N ${t.losses}D, ${t.gf}:${t.ga})`).join('\n') +
        `\n\n🧡 Ta ligue fantasy :\n` +
        lg.standings.map((r) => `${r.rank}. ${r.name} — ${r.total ?? '?'} pts${r.isUser ? ' ← TOI' : ''}`).join('\n'),
    )
  }

  // Résultats d'une journée (explicite ou dernière jouée)
  if (has(m, 'resultat', 'score final', 'qui a gagne', 'dernier match', 'derniere journee', 'qui a joue', 'hier')) {
    intents.push('resultats')
    const res = await lastResults(roundMatch ? Number(roundMatch[1]) : undefined)
    if (res) sections.push(res)
  }

  if (has(m, 'prochain', 'qui joue', 'calendrier', 'programme', 'affiche', 'semaine prochaine', 'a venir', 'à venir', 'matchs de la')) {
    intents.push('calendrier')
    const rows = await db.fixture.findMany({
      where: { round: { gte: round, lte: round + 1 }, isHome: true },
      orderBy: [{ round: 'asc' }, { kickoff: 'asc' }],
    })
    const byRound = new Map<number, typeof rows>()
    for (const f of rows) {
      if (!byRound.has(f.round)) byRound.set(f.round, [])
      byRound.get(f.round)!.push(f)
    }
    const lines = [...byRound.entries()].map(([r, fs]) =>
      `J${r} : ${fs.map((f) => `${f.club} ${f.isHome ? 'vs' : '@'} ${f.opponent} (diff. ${f.difficulty ?? '—'})`).join(' | ')}`)
    sections.push('📅 PROCHAINES AFFICHES :\n' + lines.join('\n'))
  }

  if (has(m, 'capitaine', 'bras')) {
    intents.push('capitaine')
    const a = await getA()
    const cap = a.captainMatrix.slice(0, 3)
    if (cap.length) {
      sections.push(
        '👑 CAPITAINE — matrice multi-facteurs (epNext, forme, per90, difficulté, ownership) :\n' +
          cap.map((c, i) => `${i + 1}. ${c.name} (${c.club}) — score ${fr(c.score)} — ${c.fixture} — ${c.reasons[0] ?? ''}`).join('\n'),
      )
    } else if (a.prediction?.captain) {
      sections.push(`👑 Capitaine recommandé : ${a.prediction.captain.name} (${a.prediction.captain.club}, proj. ${fr(a.prediction.captain.projected)} pt, ${a.prediction.captain.fixture}).`)
    }
  }

  if (has(m, 'transfert', 'acheter', 'vendre', 'recrute', 'mercato')) {
    intents.push('transferts')
    const a = await getA()
    if (a.transfers.length) {
      sections.push(
        '🔄 TRANSFERTS RECOMMANDÉS (moteur chiffré) :\n' +
          a.transfers.slice(0, 3).map((t, i) => `${i + 1}. ${t.out.name} → ${t.in.name} (${t.in.club}) : gain estimé ${fr(t.gain)} pt. Sortie car ${t.out.reasons[0]}. Atout : ${t.in.reasons[0] ?? ''}`).join('\n'),
      )
    } else {
      sections.push('🔄 Aucun transfert prioritaire détecté : ton effectif est bien calibré pour cette journée.')
    }
  }

  if (has(m, 'rival', 'compar', 'concurrent')) {
    intents.push('comparaisons')
    const a = await getA()
    if (a.comparisons.length) {
      sections.push(
        '⚔️ COMPARAISONS RIVAUX :\n' +
          a.comparisons.slice(0, 3).map((c) => `• ${c.name} : ${c.verdict}${c.star ? ` — étoile : ${c.star}` : ''}`).join('\n'),
      )
    } else {
      sections.push('⚔️ Les effectifs rivaux ne sont pas saisis — ajoute-les dans l\'onglet Ligue pour activer les comparaisons chiffrées.')
    }
  }

  if (has(m, 'predi', 'projection', 'onze', 'equipe type', 'lineup', 'selection', 'combien de points')) {
    intents.push('prediction')
    const a = await getA()
    if (a.prediction) {
      sections.push(
        `🔮 PRÉDICTION J${a.round} (${a.prediction.formation}) : projection ${fr(a.prediction.projectedLow)} à ${fr(a.prediction.projectedHigh)} pts.\n` +
          a.prediction.players.slice(0, 11).map((p) => `- ${p.name} (${p.club}, ${p.position}) proj. ${fr(p.projected)}${p.captain ? ' [C]' : ''} — ${p.fixturesNext[0]?.label ?? '—'}`).join('\n') +
          (a.prediction.risks.length ? `\n⚠️ Risques : ${a.prediction.risks.slice(0, 3).join(' ; ')}` : ''),
      )
    }
  }

  if (clubHit && !intents.includes('joueur')) {
    intents.push('club')
    const card = await clubCard(clubHit, round)
    if (card) sections.push(card)
  }

  if (has(m, 'salut', 'bonjour', 'hello', 'que sais', 'aide', 'help', 'que peux')) {
    intents.push('aide')
    sections.push(
      "💡 Je suis ton analyste Premier League 100% données réelles (Sofascore). Demande-moi :\n" +
        '• « classement PL » • « résultats de la dernière journée » • « qui joue la J5 ? »\n' +
        '• « top buteurs » • « capitaine ? » • « transferts ? » • « Haaland vaut quoi ? »\n' +
        "• « forme de Liverpool » • « prédiction de points » • « comparaison rivaux »",
    )
  }

  // ── Rien détecté → briefing chiffré complet ──
  if (!sections.length) {
    intents.push('briefing')
    sections.push(await defaultBriefing(getA))
  }

  return { reply: sections.slice(0, 3).join('\n\n'), intent: intents.join('+') }
}

// ═══════════════════════════════════════════════════════════════
// Helpers données
// ═══════════════════════════════════════════════════════════════

async function findPlayer(m: string) {
  const words = m.split(/\s+/).filter((w) => w.length >= 4)
  if (!words.length) return null
  const players = await db.player.findMany({
    where: { OR: words.flatMap((w) => [{ name: { contains: w, mode: 'insensitive' as const } }]) },
    select: { name: true, club: true, position: true, goals: true, assists: true, minutes: true, marketValue: true, status: true, news: true, priceRef: true, totalPoints: true },
    take: 40,
  })
  if (!players.length) return null
  let best: (typeof players)[0] | null = null
  let bestScore = 0
  for (const p of players) {
    const pn = norm(p.name)
    const score = words.filter((w) => pn.includes(w)).length
    if (score > bestScore || (score === bestScore && best && (p.minutes ?? 0) > (best.minutes ?? 0))) {
      best = p
      bestScore = score
    }
  }
  return bestScore >= 1 ? best : null
}

async function playerCard(p: NonNullable<Awaited<ReturnType<typeof findPlayer>>>, round: number): Promise<string> {
  const next = await db.fixture.findMany({
    where: { club: p.club, round: { gte: round } },
    orderBy: [{ round: 'asc' }], take: 3,
  })
  return (
    `👤 ${p.name} — ${p.club} (${p.position})\n` +
    `• Saison réelle (Sofascore) : ${p.goals ?? 0} buts, ${p.assists ?? 0} passes, ${p.minutes ?? 0} min\n` +
    `• Points fantasy : ${p.totalPoints ?? '—'}${p.priceRef ? ` — prix réf. ${fr(p.priceRef)} M£` : ''}${p.marketValue ? ` — valeur marché ${fr(Number(p.marketValue) / 1e6, 0)} M€` : ''}\n` +
    `• Statut : ${p.status}${p.news ? ` (${p.news})` : ''}\n` +
    `• Prochains matchs : ${next.map((f) => `J${f.round} ${f.isHome ? 'vs' : '@'} ${f.opponent} (diff. ${f.difficulty ?? '—'})`).join(' ; ') || '—'}`
  )
}

function findClub(m: string): string | null {
  const sorted = Object.entries(CLUB_ALIASES).sort((a, b) => b[0].length - a[0].length)
  for (const [alias, club] of sorted) {
    if (m.includes(norm(alias))) return club
  }
  return null
}

async function clubCard(club: string, round: number): Promise<string | null> {
  const st = await db.teamStanding.findFirst({ where: { club } })
  if (!st) return null
  const last = await db.fixture.findMany({
    where: { club, status: 'Ended', homeGoals: { not: null } },
    orderBy: [{ round: 'desc' }], take: 3,
  })
  const next = await db.fixture.findMany({
    where: { club, round: { gte: round } },
    orderBy: [{ round: 'asc' }], take: 3,
  })
  const formStr = last.reverse().map((f) => {
    const mine = f.isHome ? f.homeGoals! : f.awayGoals!
    const other = f.isHome ? f.awayGoals! : f.homeGoals!
    const res = mine > other ? 'V' : mine === other ? 'N' : 'D'
    return `${res} ${f.isHome ? 'vs' : '@'} ${f.opponent} (${mine}-${other})`
  }).join(' ; ')
  return (
    `🏟️ ${st.club} — ${st.position}${st.position === 1 ? 'er' : 'e'} de PL, ${st.points} pts (${st.played}J, ${st.gf}:${st.ga})\n` +
    `• Forme : ${formStr || '—'}\n` +
    `• Prochains matchs : ${next.map((f) => `J${f.round} ${f.isHome ? 'vs' : '@'} ${f.opponent} (diff. ${f.difficulty ?? '—'})`).join(' ; ') || '—'}`
  )
}

async function lastResults(round?: number) {
  const anchor = round
    ? await db.fixture.findFirst({ where: { round, status: 'Ended', homeGoals: { not: null } } })
    : await db.fixture.findFirst({ where: { status: 'Ended', homeGoals: { not: null } }, orderBy: [{ round: 'desc' }, { kickoff: 'desc' }] })
  if (!anchor) return null
  const rows = await db.fixture.findMany({
    where: { round: anchor.round, isHome: true, homeGoals: { not: null } },
    orderBy: { kickoff: 'asc' },
  })
  return `📋 RÉSULTATS J${anchor.round} (réels Sofascore) :\n` +
    rows.map((f) => `• ${f.club} ${f.homeGoals}-${f.awayGoals} ${f.opponent}`).join('\n')
}

async function defaultBriefing(getA: () => Promise<AnalysisPayload>): Promise<string> {
  const a = await getA()
  const lines: string[] = [
    `📊 Situation : ${a.league.myRank}${a.league.myRank === 1 ? 'er' : 'e'} avec ${a.league.myTotal ?? '?'} pts (écart leader : ${a.league.gapToLeader}, ${a.league.leaderName}). Journée analysée : J${a.round}.`,
  ]
  if (a.prediction) {
    lines.push(
      `Sélection prédite (${a.prediction.formation}) : ${fr(a.prediction.projectedLow)} à ${fr(a.prediction.projectedHigh)} pts.`,
      a.prediction.captain ? `Capitaine : ${a.prediction.captain.name} (${a.prediction.captain.club}, proj. ${fr(a.prediction.captain.projected)}, ${a.prediction.captain.fixture}).` : '',
    )
  }
  if (a.transfers[0]) {
    const t = a.transfers[0]
    lines.push(`Transfert prioritaire : ${t.out.name} → ${t.in.name} (${t.in.club}), gain estimé ${fr(t.gain)} pt.`)
  }
  lines.push('Pose-moi une vraie question : « classement PL », « résultats de la journée », « top buteurs », « qui joue la J5 ? », « forme de Leeds »…')
  return lines.filter(Boolean).join('\n')
}
