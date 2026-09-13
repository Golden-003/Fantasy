// Types partagés entre le moteur (serveur) et l'UI (client)
// Toutes les valeurs proviennent de l'API officielle Fantasy Premier League (réel).

export type Verdict = 'GREEN' | 'YELLOW' | 'RED'
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'
export type PlayerStatus = 'FIT' | 'INJURED' | 'SUSPENDED' | 'DOUBTFUL'
export type RotationRisk = 'LOW' | 'MEDIUM' | 'HIGH'
export type Trend = 'UP' | 'DOWN' | 'STABLE'

export interface LastMatch {
  gw: number
  oppShort: string
  venue: 'H' | 'A'
  rating: number // note dérivée du BPS réel FPL : 4 + bps/10 (max 10)
  minutes: number
  goals: number
  assists: number
}

// Statistiques réelles de saison (bootstrap FPL) — pas d'invention.
export interface PlayerStats {
  apps: number // apparitions = titularisations + entrées en jeu
  minutes: number
  starts: number
  goals: number
  assists: number
  xg: number
  xa: number
  xgi: number
  cleanSheets: number
  saves: number
  bonus: number
  bps: number
  tackles: number
  cbi: number // dégagements + blocages + interceptions (FPL)
  recoveries: number
  yellow: number
  red: number
}

export interface FixtureChip {
  gw: number
  opp: string
  venue: 'H' | 'A'
  difficulty: number // 1 facile → 5 très dur (FDR officielle FPL)
}

export interface PlayerRow {
  id: string // id FPL réel (string pour l'UI)
  fplId: number
  name: string
  teamId: string
  teamShort: string
  teamName: string
  position: Position
  price: number
  ownership: number // % réel sélectionné par les managers FPL
  status: PlayerStatus
  injuryNote: string | null
  rotationRisk: RotationRisk
  trend: Trend
  rating: number // = points par match (PPG réel FPL)
  form: number // forme réelle FPL (moyenne points 5 dernières journées)
  minutesPct: number
  expectedMinutes: number // 0-1, estimation depuis les minutes réelles
  epNext: number // points attendus officiels FPL pour la prochaine journée
  stats: PlayerStats
  last5: LastMatch[]
  fixtures: FixtureChip[]
  fixtureScore: number // 0-100, 5 prochaines journées
  projection: number // Fantasy Score J+1 (moteur, explicable)
  projection5: number // cumul projeté sur 5 journées
  verdict: Verdict
  reasons: string[]
  ownedByMe: boolean
  ownedByRivals: string[] // noms des rivaux qui le possèdent (réel)
}

export interface SquadEntry {
  slot: number
  isStarter: boolean
  isCaptain: boolean
  player: PlayerRow
}

export interface LiveNow {
  gw: number
  points: number // points réels accumulés par mon XI (multipliés capitaine inclus)
  remaining: number // matchs de mon XI pas encore joués
}

export interface MyTeamOverview {
  teamName: string
  ownerName: string
  bank: number
  transfersLeft: number
  transfersExact: boolean // true = valeur officielle (cookie), false = estimation moteur
  totalPoints: number
  rank: number
  leagueSize: number // taille réelle de la ligue privée
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
  netGain: number | null
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
  leagueName: string
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
  live: LiveNow | null
  syncedAt: string
}
