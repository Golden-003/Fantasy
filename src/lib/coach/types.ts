// Types partagés du moteur coach — Sofascore Fantasy V2
export type Pos = 'G' | 'D' | 'M' | 'A'
export type Difficulty = 'FACILE' | 'MOYEN' | 'DIFFICILE'
export type PlayerStatus = 'DISPO' | 'DOUTEUX' | 'ABSENT'

export interface FixtureLite {
  opponent: string
  isHome: boolean
  difficulty: Difficulty
  kickoff: string | null
}

export interface SquadPlayerView {
  id: string
  name: string
  club: string
  position: Pos
  role: 'TITULAIRE' | 'BANC'
  captain: boolean
  pointsR4: number | null
  price: number | null // prix Sofascore (M€) si sourcé
  priceRef: number | null // prix de référence (£M)
  status: PlayerStatus
  news: string | null
  form: number | null
  totalPoints: number | null
  minutes: number | null
  epNext: number | null
  fixtureNext: FixtureLite | null
  round: number // journée de la fixture affichée
}

export interface TeamView {
  managerId: string
  managerName: string
  isUser: boolean
  formation: string
  starters: SquadPlayerView[]
  bench: SquadPlayerView[]
  knownSpend: number
  knownPriceCount: number
  squadValueRef: number
  totals: { rounds: { round: number; points: number | null; totalAfter: number | null }[]; total: number | null }
}

export interface CaptainPick {
  rank: number
  playerId: string
  name: string
  club: string
  position: Pos
  fixture: string
  difficulty: Difficulty
  score: number
  reasons: string[]
}

export interface TransferFlag {
  playerId: string
  name: string
  kind: 'SURVEILLER' | 'GARDER' | 'DOUTE'
  reason: string
}

export interface MarketTarget {
  playerId: string
  name: string
  club: string
  position: Pos
  price: number | null
  priceRef: number | null
  epNext: number | null
  form: number | null
  rationale: string
}

export interface Alert {
  level: 'HOT' | 'WARN' | 'INFO'
  title: string
  detail: string
}

export interface StandingRow {
  rank: number
  id: string
  slug: string
  name: string
  isUser: boolean
  total: number | null
  lastRound: number | null
  lastPoints: number | null
  roundsKnown: number
}

export interface LeagueView {
  name: string
  season: string
  currentRound: number
  standings: StandingRow[]
  myRank: number
  gapToLeader: number
  gapToLast: number
  leaderName: string
}

export interface FixtureView {
  round: number
  club: string
  opponent: string
  isHome: boolean
  difficulty: Difficulty
  kickoff: string | null
}

// ── Base joueurs complète ──────────────────────────────────────

export interface PlayerRow {
  id: string
  name: string
  club: string
  position: Pos
  price: number | null
  priceRef: number | null
  status: PlayerStatus
  form: number | null
  totalPoints: number | null
  minutes: number | null
  goals: number | null
  assists: number | null
  epNext: number | null
  ownership: number | null
  ownershipRef: number | null
}

export interface PlayerDetail extends PlayerRow {
  news: string | null
  xg: number | null
  xa: number | null
  source: string
  fixtures: FixtureLite[] & { round?: number }[]
  fixturesDetailed: { round: number; opponent: string; isHome: boolean; difficulty: Difficulty; kickoff: string | null }[]
}

export interface TransferItem {
  id: string
  round: number
  outName: string | null
  inName: string | null
  note: string | null
  createdAt: string
}

export interface RoundScoreItem {
  round: number
  points: number | null
  totalAfter: number | null
}

export interface ManagerDetail {
  id: string
  slug: string
  name: string
  isUser: boolean
  squad: SquadPlayerView[]
  formation: string
  transfers: TransferItem[]
  scores: RoundScoreItem[]
  total: number | null
}

// ── Temps réel (Match Center live) ─────────────────────────────

export interface LivePlayerRow {
  playerId: string
  name: string
  club: string
  position: Pos
  role: 'TITULAIRE' | 'BANC'
  fixture: string | null
  pointsR4: number | null
  points: number | null
  updatedAt: string | null
}

export interface LiveStandingRow {
  name: string
  isUser: boolean
  baseTotal: number | null
  liveRoundPoints: number | null
  projectedTotal: number | null
  rank: number
  moved: boolean
}

export interface LiveView {
  round: number
  roundDate: string | null
  captainPlayerId: string | null
  captainName: string | null
  tripleCaptain: boolean
  multiplier: 2 | 3
  rows: LivePlayerRow[]
  live: {
    startersEntered: number
    startersTotal: number
    startersPoints: number
    captainBonus: number
    benchPoints: number
    liveRoundPoints: number
    baseTotal: number
    projectedTotal: number
    lastUpdate: string | null
  }
  standings: LiveStandingRow[]
}

export interface Overview {
  leagueName: string
  season: string
  nextRound: number
  nextRoundDate: string | null
  myRank: number
  myTotal: number
  gapToLeader: number
  gapToLast: number
  leaderName: string
  captainTop: CaptainPick | null
  alerts: Alert[]
  squadSize: number
  playerCount: number
  fixtureCount: number
}
