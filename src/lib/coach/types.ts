// Types partagés entre le moteur (serveur) et l'UI (client)

export type Verdict = 'GREEN' | 'YELLOW' | 'RED'
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'
export type PlayerStatus = 'FIT' | 'INJURED' | 'SUSPENDED' | 'DOUBTFUL'
export type RotationRisk = 'LOW' | 'MEDIUM' | 'HIGH'
export type Trend = 'UP' | 'DOWN' | 'STABLE'

export interface LastMatch {
  gw: number
  oppShort: string
  venue: 'H' | 'A'
  rating: number
  minutes: number
  goals: number
  assists: number
}

export interface PlayerStats {
  apps: number
  minutes: number
  starts: number
  goals: number
  assists: number
  xg: number
  xa: number
  shots: number
  sot: number
  bigChances: number
  keyPasses: number
  dribbles: number
  duelsWon: number
  duelsWonTotal: number
  tackles: number
  interceptions: number
  recoveries: number
  cleanSheets: number
  yellow: number
  red: number
}

export interface FixtureChip {
  gw: number
  opp: string
  venue: 'H' | 'A'
  difficulty: number // 1 facile → 5 très dur
}

export interface PlayerRow {
  id: string
  name: string
  teamId: string
  teamShort: string
  teamName: string
  position: Position
  price: number
  ownership: number
  status: PlayerStatus
  injuryNote: string | null
  rotationRisk: RotationRisk
  trend: Trend
  rating: number
  form: number
  minutesPct: number
  expectedMinutes: number // 0-1
  stats: PlayerStats
  last5: LastMatch[]
  fixtures: FixtureChip[]
  fixtureScore: number // 0-100, 5 prochaines journées
  projection: number // Fantasy Score J+1
  projection5: number // moyenne sur 5 journées
  verdict: Verdict
  reasons: string[]
  ownedByMe: boolean
  ownedByRivals: string[] // noms des rivaux qui le possèdent
}

export interface SquadEntry {
  slot: number
  isStarter: boolean
  isCaptain: boolean
  player: PlayerRow
}

export interface MyTeamOverview {
  teamName: string
  ownerName: string
  bank: number
  transfersLeft: number
  totalPoints: number
  rank: number
  squadScore: number // 0-100
  teamValue: number
  starters: SquadEntry[]
  bench: SquadEntry[]
  captainSuggestion: { name: string; projection: number } | null
  projectedGwPoints: number
  weakestStarters: { name: string; projection: number; verdict: Verdict; reason: string }[]
}

export interface SellCandidate {
  player: PlayerRow
  reason: string
}

export interface BuyCandidate {
  player: PlayerRow
  netGain: number | null // vs le joueur à vendre / le plus faible du poste
  comparedTo: string | null
  affordable: boolean
  differential: boolean
  justification: string
}

export interface TransferPlan {
  bank: number
  transfersLeft: number
  sell: SellCandidate[]
  buy: BuyCandidate[]
}

export type AlertSeverity = 'danger' | 'warning' | 'success' | 'info'
export type AlertType = 'SQUAD_RISK' | 'OPPORTUNITY' | 'FORM' | 'UNDERPERF' | 'RIVAL_THREAT' | 'CAPTAIN'

export interface AlertItem {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  detail: string
  playerId?: string
}

export interface RivalAnalysis {
  teamName: string
  ownerName: string
  totalPoints: number
  squadScore: number
  projectedGwPoints: number
  threatLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  overlap: number
  threats: { name: string; position: Position; teamShort: string; projection: number; price: number }[]
  advice: string
  squad: { name: string; position: Position; teamShort: string; isCaptain: boolean; projection: number; verdict: Verdict }[]
}

export interface LeagueData {
  myScore: number
  standings: { rank: number; teamName: string; ownerName: string; isMine: boolean; totalPoints: number; squadScore: number; projectedGwPoints: number }[]
  rivals: RivalAnalysis[]
  differentials: PlayerRow[]
}

export interface TeamFixtureRow {
  id: string
  name: string
  short: string
  fixtures: FixtureChip[]
  fixtureScore: number
}

export interface OverviewPayload {
  me: MyTeamOverview
  alerts: AlertItem[]
  transfers: TransferPlan
  nextGw: number
  seasonLabel: string
}
