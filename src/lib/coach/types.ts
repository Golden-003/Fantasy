// Types partagés du moteur coach — Sofascore Fantasy V1
export type Pos = 'G' | 'D' | 'M' | 'A'
export type Difficulty = 'FACILE' | 'MOYEN' | 'DIFFICILE' | 'INCONNU'

export interface FixtureLite {
  opponent: string
  isHome: boolean
  difficulty: Difficulty
  note: string
}

export interface SquadPlayerView {
  id: string
  name: string
  club: string
  clubConfirmed: boolean
  position: Pos
  role: 'TITULAIRE' | 'BANC'
  captain: boolean
  pointsR4: number | null
  pointsNote: string | null
  price: number | null
  ownership: number | null
  priceSource: string | null
  formNote: string | null
  fixtureR5: FixtureLite | null
}

export interface TeamView {
  formation: string
  starters: SquadPlayerView[]
  bench: SquadPlayerView[]
  knownSpend: number
  knownPriceCount: number
  unknownPriceCount: string[]
  totals: { r1: number; r2: number; r3: number; r4: number; total: number }
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
  source: string
}

export interface MarketTarget {
  playerId: string
  name: string
  club: string
  position: Pos
  price: number
  ownership: number
  formNote: string | null
  rationale: string
}

export interface Alert {
  level: 'HOT' | 'WARN' | 'INFO'
  title: string
  detail: string
  source: string
}

export interface StandingRow {
  rank: number
  name: string
  isUser: boolean
  total: number | null
  r4: number | null
  r4Known: boolean
  historyKnown: boolean
}

export interface LeagueView {
  name: string
  season: string
  standings: StandingRow[]
  myRank: number
  gapToLeader: number
  gapToLast: number
  leaderName: string
  averageR4Displayed: number
  bestR4Displayed: number
  missingData: string[]
}

export interface FixtureView {
  round: number
  club: string
  opponent: string
  isHome: boolean
  difficulty: Difficulty
  note: string
}

export interface Overview {
  leagueName: string
  game: string
  season: string
  nextRound: number
  nextRoundDate: string
  myRank: number
  myTotal: number
  gapToLeader: number
  leaderName: string
  captainTop: CaptainPick | null
  alerts: Alert[]
  budget: { knownSpend: number; knownCount: number; unknownCount: number }
  dataQuality: {
    playersTracked: number
    pricesSourced: number
    fixturesSourced: number
    dataEvents: number
  }
}
