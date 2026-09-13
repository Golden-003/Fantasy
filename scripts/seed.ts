/**
 * Seed — Sofascore Fantasy Coach
 * Génère : 20 équipes PL, ~178 joueurs, calendrier (round-robin), stats joueurs,
 * mon équipe fantasy + 4 rivaux de la ligue privée.
 * Exécuter : bun scripts/seed.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ── PRNG déterministe ──────────────────────────────────────────────────────
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rndFor = (key: string) => mulberry32(hashStr(key))

// ── Équipes Premier League 2026/27 ─────────────────────────────────────────
type TeamDef = { id: string; name: string; shortName: string; att: number; def: number }
const TEAMS: TeamDef[] = [
  { id: 'LIV', name: 'Liverpool', shortName: 'LIV', att: 5, def: 5 },
  { id: 'ARS', name: 'Arsenal', shortName: 'ARS', att: 4, def: 5 },
  { id: 'MCI', name: 'Manchester City', shortName: 'MCI', att: 5, def: 4 },
  { id: 'CHE', name: 'Chelsea', shortName: 'CHE', att: 4, def: 4 },
  { id: 'TOT', name: 'Tottenham', shortName: 'TOT', att: 4, def: 3 },
  { id: 'MUN', name: 'Manchester United', shortName: 'MUN', att: 3, def: 3 },
  { id: 'NEW', name: 'Newcastle', shortName: 'NEW', att: 4, def: 4 },
  { id: 'AVL', name: 'Aston Villa', shortName: 'AVL', att: 3, def: 3 },
  { id: 'BHA', name: 'Brighton', shortName: 'BHA', att: 3, def: 3 },
  { id: 'CRY', name: 'Crystal Palace', shortName: 'CRY', att: 3, def: 4 },
  { id: 'BOU', name: 'Bournemouth', shortName: 'BOU', att: 3, def: 3 },
  { id: 'FUL', name: 'Fulham', shortName: 'FUL', att: 3, def: 3 },
  { id: 'EVE', name: 'Everton', shortName: 'EVE', att: 2, def: 3 },
  { id: 'BRE', name: 'Brentford', shortName: 'BRE', att: 3, def: 2 },
  { id: 'WHU', name: 'West Ham', shortName: 'WHU', att: 2, def: 2 },
  { id: 'NFO', name: 'Nottingham Forest', shortName: 'NFO', att: 3, def: 3 },
  { id: 'WOL', name: 'Wolverhampton', shortName: 'WOL', att: 2, def: 2 },
  { id: 'LEE', name: 'Leeds', shortName: 'LEE', att: 2, def: 2 },
  { id: 'BUR', name: 'Burnley', shortName: 'BUR', att: 1, def: 2 },
  { id: 'SUN', name: 'Sunderland', shortName: 'SUN', att: 2, def: 2 },
]

// ── Joueurs [nom, poste, prix, qualité 0-100] ──────────────────────────────
type PDef = [string, 'GK' | 'DEF' | 'MID' | 'FWD', number, number]
const PLAYERS: Record<string, PDef[]> = {
  LIV: [
    ['Alisson', 'GK', 5.5, 82], ['Van Dijk', 'DEF', 6.6, 87], ['Konaté', 'DEF', 5.9, 74],
    ['Robertson', 'DEF', 5.7, 70], ['Szoboszlai', 'MID', 6.4, 76], ['Mac Allister', 'MID', 6.2, 73],
    ['Wirtz', 'MID', 8.3, 85], ['Salah', 'MID', 13.4, 96], ['Gakpo', 'FWD', 7.3, 74], ['Ekitike', 'FWD', 8.7, 83],
  ],
  ARS: [
    ['Raya', 'GK', 5.6, 81], ['Saliba', 'DEF', 6.2, 84], ['Gabriel', 'DEF', 6.3, 83],
    ['Timber', 'DEF', 6.0, 78], ['Calafiori', 'DEF', 5.6, 70], ['Rice', 'MID', 6.5, 80],
    ['Ødegaard', 'MID', 8.4, 87], ['Saka', 'MID', 10.1, 91], ['Eze', 'MID', 7.5, 79], ['Gyökeres', 'FWD', 9.1, 88],
  ],
  MCI: [
    ['Ederson', 'GK', 5.4, 78], ['Dias', 'DEF', 6.1, 80], ['Gvardiol', 'DEF', 6.0, 76],
    ["O'Reilly", 'DEF', 4.8, 62], ['Rodri', 'MID', 6.8, 84], ['Reijnders', 'MID', 6.9, 80],
    ['Foden', 'MID', 8.2, 85], ['Doku', 'MID', 7.2, 78], ['Cherki', 'MID', 6.3, 71], ['Haaland', 'FWD', 14.2, 98],
  ],
  CHE: [
    ['Sánchez', 'GK', 5.2, 74], ['James', 'DEF', 6.2, 77], ['Colwill', 'DEF', 5.5, 70],
    ['Chalobah', 'DEF', 5.0, 64], ['Caicedo', 'MID', 6.3, 78], ['Enzo', 'MID', 6.6, 76],
    ['Palmer', 'MID', 10.6, 92], ['Neto', 'MID', 7.4, 77], ['João Pedro', 'FWD', 8.6, 82], ['Delap', 'FWD', 6.6, 70],
  ],
  TOT: [
    ['Vicario', 'GK', 5.0, 73], ['Romero', 'DEF', 5.9, 76], ['Van de Ven', 'DEF', 5.7, 72],
    ['Porro', 'DEF', 5.8, 75], ['Bentancur', 'MID', 5.6, 68], ['Sarr', 'MID', 5.8, 70],
    ['Kudus', 'MID', 6.9, 74], ['Maddison', 'MID', 7.0, 76], ['Richarlison', 'FWD', 6.8, 70], ['Solanke', 'FWD', 7.4, 73],
  ],
  MUN: [
    ['Lammens', 'GK', 4.5, 60], ['De Ligt', 'DEF', 5.4, 68], ['Shaw', 'DEF', 4.9, 60],
    ['Dalot', 'DEF', 5.2, 64], ['Casemiro', 'MID', 5.4, 64], ['Bruno Fernandes', 'MID', 8.5, 87],
    ['Mbeumo', 'MID', 7.8, 79], ['Cunha', 'MID', 7.7, 78], ['Sesko', 'FWD', 7.0, 71], ['Zirkzee', 'FWD', 5.9, 62],
  ],
  NEW: [
    ['Pope', 'GK', 5.1, 72], ['Trippier', 'DEF', 5.3, 66], ['Botman', 'DEF', 5.4, 68],
    ['Livramento', 'DEF', 5.3, 66], ['Tonali', 'MID', 6.2, 74], ['Bruno G', 'MID', 6.0, 72],
    ['Barnes', 'MID', 6.4, 70], ['Woltemade', 'FWD', 7.2, 74], ['Gordon', 'FWD', 7.5, 76],
  ],
  AVL: [
    ['Martínez', 'GK', 5.3, 74], ['Konsa', 'DEF', 5.0, 64], ['Pau Torres', 'DEF', 5.2, 66],
    ['Digne', 'DEF', 5.0, 62], ['Kamara', 'MID', 5.3, 64], ['McGinn', 'MID', 5.6, 66],
    ['Rogers', 'MID', 6.2, 74], ['Malen', 'FWD', 5.8, 62], ['Watkins', 'FWD', 8.3, 78],
  ],
  BHA: [
    ['Verbruggen', 'GK', 4.9, 68], ['Dunk', 'DEF', 5.0, 64], ['Van Hecke', 'DEF', 4.8, 62],
    ['Wieffer', 'MID', 5.0, 60], ['Baleba', 'MID', 5.6, 70], ['Minteh', 'MID', 6.3, 68],
    ['Mitoma', 'MID', 7.3, 75], ['Rutter', 'MID', 5.9, 64], ['Welbeck', 'FWD', 6.2, 72],
  ],
  CRY: [
    ['Henderson', 'GK', 5.0, 70], ['Guéhi', 'DEF', 5.6, 74], ['Richards', 'DEF', 5.2, 66],
    ['Lacroix', 'DEF', 4.9, 61], ['Wharton', 'MID', 5.9, 70], ['Kamada', 'MID', 5.6, 64],
    ['Sarr', 'MID', 6.8, 72], ['Mateta', 'FWD', 7.4, 75], ['Nketiah', 'FWD', 5.4, 58],
  ],
  BOU: [
    ['Kepa', 'GK', 4.7, 64], ['Senesi', 'DEF', 5.0, 63], ['Truffert', 'DEF', 4.8, 60],
    ['Adams', 'MID', 5.0, 60], ['Scott', 'MID', 5.2, 62], ['Kluivert', 'MID', 6.0, 66],
    ['Semenyo', 'MID', 7.6, 84], ['Evanilson', 'FWD', 7.0, 71],
  ],
  FUL: [
    ['Leno', 'GK', 4.9, 66], ['Andersen', 'DEF', 5.0, 63], ['Bassey', 'DEF', 4.9, 61],
    ['Robinson', 'DEF', 5.4, 68], ['Berge', 'MID', 5.1, 60], ['Palhinha', 'MID', 5.3, 63],
    ['Iwobi', 'MID', 6.2, 70], ['King', 'FWD', 5.8, 62], ['Muniz', 'FWD', 6.4, 66],
  ],
  EVE: [
    ['Pickford', 'GK', 5.2, 72], ['Keane', 'DEF', 4.6, 58], ['Branthwaite', 'DEF', 5.1, 65],
    ["O'Brien", 'DEF', 4.7, 58], ['Gueye', 'MID', 5.4, 63], ['Dewsbury-Hall', 'MID', 5.3, 61],
    ['Ndiaye', 'MID', 6.1, 69], ['Grealish', 'MID', 6.6, 73], ['Barry', 'FWD', 5.9, 61], ['Beto', 'FWD', 5.5, 58],
  ],
  BRE: [
    ['Kelleher', 'GK', 4.8, 64], ['Collins', 'DEF', 4.9, 61], ['Van den Berg', 'DEF', 4.7, 58],
    ['Pinnock', 'DEF', 4.6, 57], ['Henderson', 'MID', 5.0, 59], ['Damsgaard', 'MID', 5.7, 63],
    ['Schade', 'MID', 5.9, 63], ['Thiago', 'FWD', 6.6, 68],
  ],
  WHU: [
    ['Hermansen', 'GK', 4.6, 60], ['Todibo', 'DEF', 4.8, 59], ['Kilman', 'DEF', 4.8, 59],
    ['Wan-Bissaka', 'DEF', 4.9, 60], ['Ward-Prowse', 'MID', 5.4, 62], ['Paquetá', 'MID', 5.9, 65],
    ['Bowen', 'MID', 6.5, 71], ['Wilson', 'FWD', 5.6, 59], ['Fullkrug', 'FWD', 5.8, 61],
  ],
  NFO: [
    ['Sels', 'GK', 5.2, 71], ['Murillo', 'DEF', 5.5, 70], ['Milenković', 'DEF', 5.4, 68],
    ['Aina', 'DEF', 5.3, 66], ['Sangaré', 'MID', 5.2, 61], ['Anderson', 'MID', 5.7, 64],
    ['Gibbs-White', 'MID', 6.6, 72], ['Hudson-Odoi', 'MID', 6.1, 67], ['Wood', 'FWD', 6.8, 70],
  ],
  WOL: [
    ['Sá', 'GK', 4.7, 61], ['Agbadou', 'DEF', 4.7, 58], ['Toti', 'DEF', 4.6, 56],
    ['Doherty', 'DEF', 4.5, 55], ['João Gomes', 'MID', 5.4, 62], ['André', 'MID', 5.3, 61],
    ['Hwang', 'FWD', 5.7, 59], ['Strand Larsen', 'FWD', 6.3, 65],
  ],
  LEE: [
    ['Meslier', 'GK', 4.5, 57], ['Rodon', 'DEF', 4.6, 56], ['Struijk', 'DEF', 4.5, 54],
    ['Ampadu', 'MID', 4.9, 57], ['Gruev', 'MID', 4.7, 54], ['Aaronson', 'MID', 4.9, 55],
    ['Gnonto', 'MID', 5.3, 58], ['Nmecha', 'MID', 4.8, 54], ['Piroe', 'FWD', 5.6, 59],
  ],
  BUR: [
    ['Dubravka', 'GK', 4.5, 56], ['Esteve', 'DEF', 4.5, 54], ['Egan-Riley', 'DEF', 4.4, 53],
    ['Cullen', 'MID', 4.6, 53], ['Laurent', 'MID', 4.6, 53], ['Bruun Larsen', 'MID', 4.9, 55],
    ['Foster', 'FWD', 5.1, 56], ['Anthony', 'FWD', 4.9, 54],
  ],
  SUN: [
    ['Patterson', 'GK', 4.6, 58], ['Ballard', 'DEF', 4.8, 58], ["O'Nien", 'DEF', 4.7, 56],
    ['Hume', 'DEF', 4.7, 56], ['Xhaka', 'MID', 5.4, 63], ['Sadiki', 'MID', 4.9, 56],
    ['Diarra', 'MID', 4.8, 55], ['Isidor', 'FWD', 5.4, 58], ['Mayenda', 'FWD', 5.2, 56],
  ],
}

// ── Overrides narratives (statuts, forme, différentiels) ──────────────────
type Override = { status?: string; injuryNote?: string; rotationRisk?: string; trend?: string; ownership?: number }
const OVERRIDES: Record<string, Override> = {
  Salah: { trend: 'UP', ownership: 58 },
  Haaland: { trend: 'UP', ownership: 62 },
  Saka: { trend: 'UP' },
  'Gyökeres': { trend: 'UP', ownership: 45 },
  Palmer: { ownership: 49 },
  Semenyo: { trend: 'UP', ownership: 48 },
  Grealish: { trend: 'UP', ownership: 9 },
  Cherki: { trend: 'UP', ownership: 11 },
  Mitoma: { ownership: 14 },
  Rogers: { status: 'DOUBTFUL', injuryNote: 'Petit coup à la cuisse — test avant le coup d’envoi', trend: 'UP', ownership: 21 },
  Maddison: { status: 'INJURED', injuryNote: 'Blessure au genou — absent environ 6 semaines', rotationRisk: 'HIGH' },
  Saliba: { status: 'SUSPENDED', injuryNote: 'Suspendu 1 match (carton rouge)' },
  Wood: { trend: 'DOWN' },
  Watkins: { trend: 'DOWN' },
  Zirkzee: { rotationRisk: 'HIGH' },
  Malen: { rotationRisk: 'HIGH' },
  Nketiah: { rotationRisk: 'HIGH' },
  Beto: { rotationRisk: 'HIGH' },
  Wilson: { rotationRisk: 'HIGH' },
  Fullkrug: { rotationRisk: 'MEDIUM' },
  Kudus: { rotationRisk: 'MEDIUM' },
  Gakpo: { rotationRisk: 'MEDIUM' },
  Richarlison: { rotationRisk: 'MEDIUM' },
  Delap: { rotationRisk: 'MEDIUM' },
  Mayenda: { rotationRisk: 'HIGH' },
  Gnonto: { rotationRisk: 'MEDIUM' },
  Eze: { trend: 'UP', rotationRisk: 'MEDIUM' },
  Doku: { trend: 'UP' },
  Wirtz: { trend: 'UP' },
  Cunha: { trend: 'UP' },
  Mbeumo: { trend: 'UP' },
  Woltemade: { trend: 'UP' },
  Gordon: { trend: 'UP' },
}

// ── Calendrier : round-robin (méthode du cercle) ───────────────────────────
function buildSchedule(ids: string[]) {
  const n = ids.length
  const rounds: { home: string; away: string }[][] = []
  const rotation = ids.slice(1)
  for (let r = 0; r < n - 1; r++) {
    const fixtures: { home: string; away: string }[] = []
    const arr = [ids[0], ...rotation]
    for (let i = 0; i < n / 2; i++) {
      let home = arr[i]
      let away = arr[n - 1 - i]
      if (r % 2 === 1) [home, away] = [away, home]
      fixtures.push({ home, away })
    }
    rounds.push(fixtures)
    rotation.push(rotation.shift() as string)
  }
  return rounds // 19 journées
}

function saturdayDates(count: number): Date[] {
  // 8 derniers samedis (joués) puis les suivants — calés sur aujourd'hui
  const now = new Date()
  const dow = now.getDay() // 0 dim … 6 sam
  const daysSinceSat = (dow + 1) % 7
  const lastSat = new Date(now)
  lastSat.setDate(now.getDate() - daysSinceSat)
  const dates: Date[] = []
  const d = new Date(lastSat)
  d.setDate(d.getDate() - 7 * (count - 1))
  for (let i = 0; i < count; i++) {
    dates.push(new Date(d))
    d.setDate(d.getDate() + 7)
  }
  return dates
}

const fmtDate = (d: Date) => d.toISOString().slice(0, 10)

// ── Génération des stats joueurs ───────────────────────────────────────────
function ratingBase(pos: string, q: number): number {
  const f = q / 100
  if (pos === 'GK') return 6.45 + Math.pow(f, 1.2) * 0.85
  if (pos === 'DEF') return 6.35 + Math.pow(f, 1.4) * 1.05
  if (pos === 'MID') return 6.2 + Math.pow(f, 1.5) * 1.8
  return 6.15 + Math.pow(f, 1.6) * 2.0
}

function generatePlayer(name: string, team: TeamDef, def: PDef, pastFixtures: { oppShort: string; venue: 'H' | 'A'; oppAtt: number; oppDef: number }[]) {
  const [pname, pos, price, q] = def
  const r = rndFor(pname + team.id)
  const ov = OVERRIDES[pname] ?? {}

  const trend = ov.trend ?? (r() < 0.3 ? 'UP' : r() < 0.62 ? 'STABLE' : 'DOWN')
  const rotationRisk = ov.rotationRisk ?? (q < 62 ? (r() < 0.35 ? 'HIGH' : 'MEDIUM') : q < 72 ? (r() < 0.3 ? 'MEDIUM' : 'LOW') : 'LOW')
  const status = ov.status ?? 'FIT'
  const injuryNote = ov.injuryNote ?? null

  // Apps / minutes
  let apps: number, starts: number
  if (rotationRisk === 'HIGH') { apps = 4 + Math.floor(r() * 2); starts = Math.max(1, apps - 2) }
  else if (rotationRisk === 'MEDIUM') { apps = 6 + Math.floor(r() * 2); starts = apps - 1 }
  else { apps = 7 + Math.floor(r() * 2); starts = Math.max(6, apps - (r() < 0.3 ? 1 : 0)) }
  const avgMin = rotationRisk === 'HIGH' ? 55 + r() * 20 : rotationRisk === 'MEDIUM' ? 68 + r() * 16 : 78 + r() * 12
  const minutes = Math.round(apps * avgMin)

  // Production offensive
  const f = q / 100
  let g90 = 0, a90 = 0
  if (pos === 'FWD') { g90 = f * f * 0.95; a90 = f * f * 0.3 }
  else if (pos === 'MID') { g90 = f * f * 0.5 + (q >= 93 ? 0.1 : 0); a90 = Math.pow(f, 1.8) * 0.42 }
  else if (pos === 'DEF') { g90 = f * f * 0.12; a90 = Math.pow(f, 1.8) * 0.15 }
  const goals = pos === 'GK' ? 0 : Math.max(0, Math.round(g90 * apps + (r() - 0.5) * 1.6))
  const assists = pos === 'GK' ? 0 : Math.max(0, Math.round(a90 * apps + (r() - 0.5) * 1.4))
  const xg = Math.round((goals * (0.75 + r() * 0.5) + (pos !== 'GK' ? 0.4 : 0)) * 10) / 10
  const xa = Math.round((assists * (0.8 + r() * 0.4) + (pos === 'MID' ? 0.5 : pos === 'FWD' ? 0.3 : 0.1)) * 10) / 10

  const shots = pos === 'FWD' ? Math.round(goals * (3.2 + r() * 2) + 2) : pos === 'MID' ? Math.round(goals * (2.6 + r() * 2) + 2 + f * 4) : Math.round(goals * 1.5 + r() * 2)
  const sot = Math.round(shots * (0.36 + r() * 0.12))
  const bigChances = pos === 'MID' ? Math.round(assists * 1.4 + r() * 3) : pos === 'FWD' ? Math.round(goals * 1.1 + r() * 3) : Math.round(assists * 0.8 + r() * 1)
  const keyPasses = pos === 'MID' ? Math.round(assists * 2.4 + f * 9 + r() * 6) : pos === 'FWD' ? Math.round(assists * 1.8 + r() * 5) : Math.round(assists * 2 + r() * 3)
  const dribbles = pos === 'MID' || pos === 'FWD' ? Math.round(Math.pow(f, 1.5) * 14 + r() * 6) : Math.round(f * 4 + r() * 3)
  const duelsWon = pos === 'DEF' ? Math.round(40 + r() * 30) : pos === 'MID' ? Math.round(30 + r() * 25) : pos === 'FWD' ? Math.round(20 + r() * 20) : Math.round(3 + r() * 5)
  const tackles = pos === 'DEF' ? Math.round(18 + r() * 12) : pos === 'MID' ? Math.round(12 + r() * 13) : Math.round(r() * 4)
  const interceptions = pos === 'DEF' ? Math.round(10 + r() * 10) : pos === 'MID' ? Math.round(6 + r() * 8) : Math.round(r() * 3)
  const recoveries = pos === 'DEF' ? Math.round(60 + r() * 30) : pos === 'MID' ? Math.round(50 + r() * 25) : pos === 'FWD' ? Math.round(25 + r() * 15) : Math.round(15 + r() * 10)
  const csRate = 0.15 + team.def * 0.09
  const cleanSheets = pos === 'GK' || pos === 'DEF' ? Math.round(starts * csRate) : Math.round(starts * csRate * 0.4)
  const yellow = Math.round(r() * 3 + (pos === 'DEF' || pos === 'MID' ? 1 : 0))
  const red = pname === 'Saliba' ? 1 : r() < 0.04 ? 1 : 0

  const rating = Math.round((ratingBase(pos, q) + (r() - 0.5) * 0.3) * 10) / 10

  // 5 derniers matchs
  const formShift = trend === 'UP' ? 0.35 : trend === 'DOWN' ? -0.35 : 0
  const last5 = pastFixtures.slice(0, 5).map((fx, i) => {
    const rr = rndFor(pname + 'm' + i)
    const playedMin = rotationRisk === 'HIGH' ? Math.round(20 + rr() * 55) : rotationRisk === 'MEDIUM' ? Math.round(50 + rr() * 40) : Math.round(70 + rr() * 20)
    const gl = playedMin > 55 ? (g90 * (playedMin / 90) > rr() ? 1 : 0) + (g90 * (playedMin / 90) > rr() + 0.7 ? 1 : 0) : 0
    const as = playedMin > 55 ? (a90 * (playedMin / 90) > rr() ? 1 : 0) : 0
    const rt = Math.max(4.2, Math.min(9.4, rating + formShift + (rr() - 0.5) * 1.1 + gl * 0.55 + as * 0.45))
    return { gw: 8 - i, oppShort: fx.oppShort, venue: fx.venue, rating: Math.round(rt * 10) / 10, minutes: playedMin, goals: gl, assists: as }
  })

  // Ownership
  let ownership = ov.ownership ?? Math.min(62, Math.max(1, (Math.pow(Math.max(0, q - 52), 1.35) / 2) * (0.75 + r() * 0.5)))
  ownership = Math.round(ownership * 10) / 10

  const stats = { apps, minutes, starts, goals, assists, xg, xa, shots, sot, bigChances, keyPasses, dribbles, duelsWon, duelsWonTotal: duelsWon + Math.round(r() * 20), tackles, interceptions, recoveries, cleanSheets, yellow, red }

  return { name: pname, teamId: team.id, position: pos, price, quality: q, ownership, status, injuryNote, rotationRisk, trend, rating, statsJson: JSON.stringify(stats), last5Json: JSON.stringify(last5) }
}

// ── Équipes fantasy ────────────────────────────────────────────────────────
const MY_SQUAD = {
  teamName: 'FC Le Général', ownerName: 'Toi', bank: 2.4, transfersLeft: 2, totalPoints: 512,
  starters: ['Alisson', 'Van Dijk', 'Gabriel', 'Porro', 'Timber', 'Salah', 'Saka', 'Semenyo', 'Rogers', 'Haaland', 'Ekitike'],
  bench: ['Vicario', 'Senesi', 'Baleba', 'Welbeck'],
  captain: 'Salah',
}
const RIVALS: { teamName: string; ownerName: string; bank: number; transfersLeft: number; totalPoints: number; starters: string[]; bench: string[]; captain: string }[] = [
  {
    teamName: 'Les Loups d’Alex', ownerName: 'Alex', bank: 1.1, transfersLeft: 1, totalPoints: 534,
    starters: ['Ederson', 'Saliba', 'Gvardiol', 'Aina', 'Palmer', 'Reijnders', 'Minteh', 'Gibbs-White', 'Haaland', 'João Pedro', 'Mateta'],
    bench: ['Sánchez', 'Chalobah', 'Scott', 'Delap'], captain: 'Haaland',
  },
  {
    teamName: 'Mehdi XI', ownerName: 'Mehdi', bank: 3.2, transfersLeft: 2, totalPoints: 521,
    starters: ['Raya', 'Dias', 'Guéhi', 'Robinson', 'Murillo', 'Mbeumo', 'Eze', 'Rice', 'Kudus', 'Gyökeres', 'Watkins'],
    bench: ['Kelleher', 'Andersen', 'Berge', 'Muniz'], captain: 'Gyökeres',
  },
  {
    teamName: 'Les Bleus de Thomas', ownerName: 'Thomas', bank: 0.8, transfersLeft: 0, totalPoints: 498,
    starters: ['Henderson', 'Konaté', 'Van de Ven', 'Livramento', 'Bruno Fernandes', 'Foden', 'Paquetá', 'Sarr', 'Solanke', 'Wood', 'Richarlison'],
    bench: ['Sá', 'Digne', 'Damsgaard', 'Wilson'], captain: 'Bruno Fernandes',
  },
  {
    teamName: 'Karim Elites', ownerName: 'Karim', bank: 4.5, transfersLeft: 3, totalPoints: 489,
    starters: ['Pope', 'Botman', 'Konsa', 'Kilman', 'Wirtz', 'Cherki', 'Barnes', 'Tonali', 'Gordon', 'Strand Larsen', 'Evanilson'],
    bench: ['Verbruggen', 'Wieffer', 'Hwang', 'Wan-Bissaka'], captain: 'Wirtz',
  },
]

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('Nettoyage…')
  await db.squadSlot.deleteMany()
  await db.fantasyTeam.deleteMany()
  await db.fixture.deleteMany()
  await db.player.deleteMany()
  await db.team.deleteMany()

  console.log('Équipes…')
  await db.team.createMany({ data: TEAMS })
  const teamsById = Object.fromEntries(TEAMS.map((t) => [t.id, t]))

  // Calendrier 13 journées
  console.log('Calendrier…')
  const rounds = buildSchedule(TEAMS.map((t) => t.id))
  const GW_PLAYED = 8
  const dates = saturdayDates(13)
  const fixtures: { id: string; gw: number; homeTeamId: string; awayTeamId: string; date: string }[] = []
  const pastByTeam: Record<string, { oppShort: string; venue: 'H' | 'A'; oppAtt: number; oppDef: number }[]> = {}
  const futureByTeam: Record<string, { gw: number; oppShort: string; venue: 'H' | 'A'; oppDef: number; oppAtt: number }[]> = {}
  for (let gw = 1; gw <= 13; gw++) {
    for (const fx of rounds[gw - 1]) {
      fixtures.push({ id: `GW${gw}-${fx.home}-${fx.away}`, gw, homeTeamId: fx.home, awayTeamId: fx.away, date: fmtDate(dates[gw - 1]) })
      const home = teamsById[fx.home], away = teamsById[fx.away]
      if (gw <= GW_PLAYED) {
        ;(pastByTeam[fx.home] ??= []).push({ oppShort: away.shortName, venue: 'H', oppAtt: away.att, oppDef: away.def })
        ;(pastByTeam[fx.away] ??= []).push({ oppShort: home.shortName, venue: 'A', oppAtt: home.att, oppDef: home.def })
      } else {
        ;(futureByTeam[fx.home] ??= []).push({ gw, oppShort: away.shortName, venue: 'H', oppDef: away.def, oppAtt: away.att })
        ;(futureByTeam[fx.away] ??= []).push({ gw, oppShort: home.shortName, venue: 'A', oppDef: home.def, oppAtt: home.att })
      }
    }
  }
  await db.fixture.createMany({ data: fixtures })

  // Joueurs
  console.log('Joueurs…')
  const players: ReturnType<typeof generatePlayer>[] = []
  for (const team of TEAMS) {
    const past = pastByTeam[team.id] ?? []
    for (const def of PLAYERS[team.id]) players.push(generatePlayer(def[0], team, def, past))
  }
  await db.player.createMany({ data: players })
  const allPlayers = await db.player.findMany()
  const dbIdOf = new Map(allPlayers.map((p) => [p.name, p.id]))

  // Équipes fantasy
  console.log('Équipes fantasy…')
  const me = await db.fantasyTeam.create({
    data: { teamName: MY_SQUAD.teamName, ownerName: MY_SQUAD.ownerName, isMine: true, bank: MY_SQUAD.bank, transfersLeft: MY_SQUAD.transfersLeft, totalPoints: MY_SQUAD.totalPoints },
  })
  const insertSquad = async (teamId: string, sq: typeof MY_SQUAD) => {
    let slot = 0
    for (const name of sq.starters) {
      await db.squadSlot.create({ data: { id: `${teamId}-s${slot}`, fantasyTeamId: teamId, playerId: dbIdOf.get(name)!, slot, isStarter: true, isCaptain: name === sq.captain } })
      slot++
    }
    for (const name of sq.bench) {
      await db.squadSlot.create({ data: { id: `${teamId}-s${slot}`, fantasyTeamId: teamId, playerId: dbIdOf.get(name)!, slot, isStarter: false, isCaptain: false } })
      slot++
    }
  }
  await insertSquad(me.id, MY_SQUAD)
  for (const rv of RIVALS) {
    const t = await db.fantasyTeam.create({
      data: { teamName: rv.teamName, ownerName: rv.ownerName, isMine: false, bank: rv.bank, transfersLeft: rv.transfersLeft, totalPoints: rv.totalPoints },
    })
    await insertSquad(t.id, rv)
  }

  console.log(`✅ Seed terminé : ${TEAMS.length} équipes, ${players.length} joueurs, ${fixtures.length} matchs, 5 équipes fantasy.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
