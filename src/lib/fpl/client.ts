// ─── Client de l'API officielle Fantasy Premier League (DONNÉES 100% RÉELLES) ───
// Source : https://fantasy.premierleague.com/api — endpoints publics documentés de facto.
// Cache mémoire + déduplication des requêtes en vol pour respecter les rate limits.

const BASE = 'https://fantasy.premierleague.com/api'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

type CacheEntry = { at: number; data: unknown }
type Inflight = Map<string, Promise<unknown>>

const g = globalThis as typeof globalThis & {
  __fplCache?: Map<string, CacheEntry>
  __fplInflight?: Inflight
}
const cache = (g.__fplCache ??= new Map())
const inflight = (g.__fplInflight ??= new Map())

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fplFetch<T>(path: string, cookie?: string): Promise<T> {
  const headers: Record<string, string> = { 'User-Agent': UA, Accept: 'application/json' }
  if (cookie) headers.Cookie = cookie

  let lastErr: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`FPL API ${res.status}`)
        await sleep(1200)
        continue
      }
      if (res.status === 404) throw new Error('NOT_FOUND')
      if (res.status === 401 || res.status === 403) throw new Error('AUTH_REQUIRED')
      if (!res.ok) throw new Error(`FPL API ${res.status}`)
      return (await res.json()) as T
    } catch (e) {
      if (e instanceof Error && (e.message === 'NOT_FOUND' || e.message === 'AUTH_REQUIRED')) throw e
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('FPL API injoignable')
}

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T
  const running = inflight.get(key)
  if (running) return running as Promise<T>
  const p = loader()
    .then((data) => {
      cache.set(key, { at: Date.now(), data })
      return data
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export function invalidate(prefix?: string) {
  for (const k of [...cache.keys()]) if (!prefix || k.startsWith(prefix)) cache.delete(k)
}

// ─── Types bruts (sous-ensembles utilisés) ───

export interface FplEvent {
  id: number
  name: string
  deadline_time: string
  finished: boolean
  is_current: boolean
  is_next: boolean
  average_entry_score: number | null
}

export interface FplTeam {
  id: number
  code: number
  name: string
  short_name: string
}

export interface FplElement {
  id: number
  code: number
  web_name: string
  first_name: string
  second_name: string
  team: number
  team_code: number
  element_type: number
  now_cost: number
  event_points: number
  total_points: number
  points_per_game: string
  form: string
  minutes: number
  starts: number
  goals_scored: number
  assists: number
  clean_sheets: number
  goals_conceded: number
  saves: number
  bonus: number
  bps: number
  influence: string
  creativity: string
  threat: string
  ict_index: string
  expected_goals: string
  expected_assists: string
  expected_goal_involvements: string
  expected_goals_conceded: string
  tackles: number
  recoveries: number
  clearances_blocks_interceptions: number
  yellow_cards: number
  red_cards: number
  own_goals: number
  penalties_saved: number
  penalties_missed: number
  selected_by_percent: string
  value_form: string
  status: 'a' | 'd' | 'i' | 's' | 'u' | 'n'
  news: string
  chance_of_playing_this_round: number | null
  chance_of_playing_next_round: number | null
  ep_next: string | number
  ep_this: string | number
  cost_change_event: number
  transfers_in: number
  transfers_out: number
  removed: boolean
  special: boolean
}

export interface FplFixture {
  id: number
  event: number | null
  team_h: number
  team_a: number
  team_h_difficulty: number
  team_a_difficulty: number
  kickoff_time: string | null
  started: boolean
  finished: boolean
  finished_provisional: boolean
}

export interface FplPicks {
  active_chip: string | null
  automatic_subs: { element_in: number; element_out: number; event: number }[]
  entry_history: { event: number; points: number; total_points: number; bank: number; value: number; event_transfers: number; event_transfers_cost: number; points_on_bench: number }
  picks: { element: number; position: number; multiplier: number; is_captain: boolean; is_vice_captain: boolean }[]
  // Présent uniquement sur /my-team/{id}/ (endpoint authentifié)
  transfers?: { limit: number; made: number; cost: number; status: string | null; bank: number; value: number }
}

export interface FplEntryHistory {
  current: { event: number; points: number; total_points: number; rank: number; overall_rank: number; bank: number; value: number; event_transfers: number; event_transfers_cost: number; points_on_bench: number }[]
  chips: { name: string; event: number; played_time: string }[]
}

export interface FplEntry {
  id: number
  name: string
  player_first_name: string
  player_last_name: string
  summary_overall_points: number
  summary_overall_rank: number
  favourite_team: number | null
}

export interface FplLiveElementStats {
  minutes: number
  goals_scored: number
  assists: number
  clean_sheets: number
  goals_conceded: number
  saves: number
  bonus: number
  bps: number
  total_points: number
  yellow_cards: number
  red_cards: number
  own_goals: number
  expected_goals: number | null
  expected_assists: number | null
}

export interface FplLive {
  elements: { id: number; stats: FplLiveElementStats }[]
  fixtures?: { is_started: boolean; finished: boolean; team_h: number; team_a: number }[]
}

export interface FplLeagueStandings {
  league: { id: number; name: string; created: string; closed: boolean; max_entries: number | null }
  standings: {
    has_next: boolean
    page: number
    results: { id: number; entry: number; entry_name: string; player_name: string; movement: string; last_rank: number; rank_sort: number; total: number; event_total: number }[]
  }
}

export interface Bootstrap {
  events: FplEvent[]
  teams: FplTeam[]
  elements: FplElement[]
}

// ─── Endpoints typés + cache ───

export const getBootstrap = () => cached<Bootstrap>('bootstrap', 10 * 60_000, () => fplFetch('/bootstrap-static/'))

export const getFixtures = () => cached<FplFixture[]>('fixtures', 10 * 60_000, () => fplFetch('/fixtures/'))

export const getEvents = async () => (await getBootstrap()).events

export const getLive = (gw: number, isCurrent: boolean) =>
  cached<FplLive>(`live:${gw}`, isCurrent ? 60_000 : 60 * 60_000, () => fplFetch(`/event/${gw}/live/`))

export const getEntry = (teamId: number) =>
  cached<FplEntry>(`entry:${teamId}`, 5 * 60_000, () => fplFetch(`/entry/${teamId}/`))

export const getEntryHistory = (teamId: number) =>
  cached<FplEntryHistory>(`entryhist:${teamId}`, 5 * 60_000, () => fplFetch(`/entry/${teamId}/history/`))

export const getEntryPicks = (teamId: number, gw: number) =>
  cached<FplPicks>(`picks:${teamId}:${gw}`, 3 * 60_000, () => fplFetch(`/entry/${teamId}/event/${gw}/picks/`))

export const getLeagueStandings = (leagueId: number) =>
  cached<FplLeagueStandings>(`league:${leagueId}`, 5 * 60_000, () =>
    fplFetch(`/leagues-classic/${leagueId}/standings/?page_new_entries=1&page_standings=1`),
  )

// Endpoint authentifié (cookie de session) — utilisé uniquement si l'utilisateur colle son cookie.
export const getMyTeam = (teamId: number, cookie: string) =>
  cached<FplPicks>(`myteam:${teamId}`, 60_000, () => fplFetch(`/my-team/${teamId}/`, cookie))
