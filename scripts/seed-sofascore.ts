/**
 * SEED 100% RÉEL — Sofascore Fantasy Coach V1
 * Ligue privée « Le fond de la classe » (5 managers), saison 2026/27.
 *
 * SOURCES (aucune donnée inventée) :
 *  - CAPTURE-CLASSEMENT-13SEPT : capture onglet « Ligues » du 13/09/2026 21:22
 *  - CAPTURE-EQUIPE-13SEPT     : capture onglet « Mon équipe » du 13/09/2026 21:45
 *  - ARTICLE-PICKS-R4          : sofascore.com/news/premier-league-fantasy-picks-round-4-2 (11/09/2026)
 *  - ARTICLE-NOUVEAUTES-2627   : « Sofascore Fantasy 2026/27: What's New » (28/08/2026)
 *
 * Prix / ownership : UNIQUEMENT ceux publiés dans l'article officiel.
 * Tout ce qui n'est pas sourcé = null et apparaîtra « à confirmer » dans l'app.
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const S_CAPTURE_CL = 'CAPTURE-CLASSEMENT-13SEPT (21:22)'
const S_CAPTURE_EQ = 'CAPTURE-EQUIPE-13SEPT (21:45)'
const S_ARTICLE = 'ARTICLE-PICKS-R4 (officiel, 11/09/2026)'

async function main() {
  // ── Nettoyage ──────────────────────────────────────────────
  await db.dataEvent.deleteMany()
  await db.squadSlot.deleteMany()
  await db.roundScore.deleteMany()
  await db.player.deleteMany()
  await db.fixture.deleteMany()
  await db.manager.deleteMany()
  await db.league.deleteMany()

  // ── Ligue réelle ───────────────────────────────────────────
  await db.league.create({
    data: {
      id: 'lefond',
      name: 'Le fond de la classe',
      game: 'Sofascore Fantasy Premier League',
      season: '2026/27',
      budget: 100,
    },
  })

  // ── Managers réels + scores réels ──────────────────────────
  // Classement officiel après R4 (capture 21:22) :
  //   nik Leroy 333 (R4:108) · Donatien_10 318 · Aziza FC 295 · Vital_GDB 284 · Zarés JR 283
  const nik = await db.manager.create({ data: { slug: 'nik_leroy', name: 'nik Leroy', isUser: false, sortOrder: 1 } })
  const donatien = await db.manager.create({ data: { slug: 'donatien_10', name: 'Donatien_10', isUser: false, sortOrder: 2 } })
  const aziza = await db.manager.create({ data: { slug: 'aziza_fc', name: 'Aziza FC', isUser: false, sortOrder: 3 } })
  const vital = await db.manager.create({ data: { slug: 'vital_gdb', name: 'Vital_GDB', isUser: true, sortOrder: 4 } })
  const zares = await db.manager.create({ data: { slug: 'zares_jr', name: 'Zarés JR', isUser: false, sortOrder: 5 } })

  // Vital_GDB : R1→R4 individuels connus (capture équipe) + total officiel 284
  const vitalScores = [
    { round: 1, points: 71, totalAfter: null },
    { round: 2, points: 66, totalAfter: null },
    { round: 3, points: 76, totalAfter: null },
    { round: 4, points: 71, totalAfter: 284 },
  ]
  for (const s of vitalScores) {
    await db.roundScore.create({
      data: { managerId: vital.id, ...s, source: s.round === 4 ? `${S_CAPTURE_EQ} · total: ${S_CAPTURE_CL}` : S_CAPTURE_EQ },
    })
  }
  // nik Leroy : R4 = 108 (capture classement), R1-R3 individuels inconnus
  await db.roundScore.create({
    data: { managerId: nik.id, round: 4, points: 108, totalAfter: 333, source: S_CAPTURE_CL },
  })
  // Totaux officiels après R4 pour les 3 autres (R4 individuel à confirmer)
  for (const m of [{ id: donatien.id, total: 318 }, { id: aziza.id, total: 295 }, { id: zares.id, total: 283 }]) {
    await db.roundScore.create({
      data: { managerId: m.id, round: 4, points: null, totalAfter: m.total, source: S_CAPTURE_CL },
    })
  }

  // ── Joueurs réels ──────────────────────────────────────────
  type P = {
    key: string; name: string; club: string; clubConfirmed?: boolean; pos: 'G' | 'D' | 'M' | 'A'
    price?: number; own?: number; src?: string; form?: string
    role?: 'TITULAIRE' | 'BANC'; captain?: boolean; ptsR4?: number; ptsNote?: string
  }

  const players: P[] = [
    // ——— XI titulaire R4 de Vital_GDB (capture 21:45) ———
    { key: 'raya', name: 'David Raya', club: 'Arsenal', pos: 'G', price: 6.6, own: 28.8, src: S_ARTICLE, form: 'GK le plus sélectionné du jeu', role: 'TITULAIRE', ptsR4: 16 },
    { key: 'guehi', name: 'Marc Guéhi', club: 'Manchester City', clubConfirmed: false, pos: 'D', role: 'TITULAIRE', ptsR4: 8, ptsNote: 'badge bleu ciel : club à confirmer' },
    { key: 'justin', name: 'James Justin', club: 'Leeds United', clubConfirmed: false, pos: 'D', role: 'TITULAIRE', ptsR4: null, ptsNote: 'match vs Newcastle pas encore joué à la capture' },
    { key: 'khusanov', name: 'Abdukodir Khusanov', club: 'Manchester City', pos: 'D', role: 'TITULAIRE', ptsR4: 0, ptsNote: 'pas entré en jeu lors du derby' },
    { key: 'tavernier', name: 'Tavernier', club: 'Bournemouth', clubConfirmed: false, pos: 'M', role: 'TITULAIRE', ptsR4: 10, ptsNote: 'club à confirmer (couleurs badge)' },
    { key: 'rice', name: 'Declan Rice', club: 'Arsenal', pos: 'M', role: 'TITULAIRE', ptsR4: 8 },
    { key: 'szoboszlai', name: 'Dominik Szoboszlai', club: 'Liverpool', pos: 'M', price: 8.0, own: 21.6, src: S_ARTICLE, form: 'Source de points fiable', role: 'TITULAIRE', ptsR4: 6 },
    { key: 'odegaard', name: 'Martin Ødegaard', club: 'Arsenal', pos: 'M', price: 7.8, own: 9.7, src: S_ARTICLE, form: 'LE milieu en forme de toute la ligue', role: 'TITULAIRE', ptsR4: 6 },
    { key: 'fernandes', name: 'Bruno Fernandes', club: 'Manchester United', pos: 'M', role: 'TITULAIRE', ptsR4: 4, ptsNote: 'derby perdu 0-1' },
    { key: 'haaland', name: 'Erling Haaland', club: 'Manchester City', pos: 'A', price: 12.0, own: 75.5, src: S_ARTICLE, form: 'Le plus cher et le plus détenu du jeu (75,5%)', role: 'TITULAIRE', captain: true, ptsR4: 18, ptsNote: 'buteur du derby Man Utd 0-1 Man City' },
    { key: 'wissa', name: 'Yoane Wissa', club: 'Newcastle United', pos: 'A', price: 5.7, own: 12.4, src: S_ARTICLE, form: 'Bonne forme de début de saison', role: 'TITULAIRE', ptsR4: null, ptsNote: 'match vs Leeds en direct à la capture' },
    // ——— Banc R4 (capture 21:45) ———
    { key: 'matthews', name: 'Matthews', club: 'Crystal Palace', clubConfirmed: false, pos: 'G', role: 'BANC', ptsR4: 0 },
    { key: 'lacroix', name: 'Maxence Lacroix', club: 'Crystal Palace', clubConfirmed: false, pos: 'D', role: 'BANC', ptsR4: 1 },
    { key: 'akpom', name: 'Chuba Akpom', club: 'À confirmer', clubConfirmed: false, pos: 'A', role: 'BANC', ptsR4: 0 },
    { key: 'egan', name: 'John Egan', club: 'Hull City', pos: 'D', price: 4.2, own: 2.5, src: S_ARTICLE, form: 'Un des défenseurs en forme toute catégorie', role: 'BANC', ptsR4: 1 },
    // ——— Marché sourcé (article officiel, hors effectif) ———
    { key: 'trafford', name: 'James Trafford', club: 'Leeds United', pos: 'G', price: 4.6, own: 11.2, src: S_ARTICLE, form: 'Titulaire indiscutable Leeds, arrêts prolifiques' },
    { key: 'gvardiol', name: 'Joško Gvardiol', club: 'Manchester City', pos: 'D', price: 6.8, own: 17.4, src: S_ARTICLE, form: 'Défenseur en forme, menace offensive' },
    { key: 'white', name: 'Ben White', club: 'Arsenal', pos: 'D', price: 5.2, own: 4.5, src: S_ARTICLE, form: 'Meilleur rapport qualité/prix défensif du jeu' },
    { key: 'hall', name: 'Lewis Hall', club: 'Newcastle United', pos: 'D', price: 5.8, own: 11.1, src: S_ARTICLE, form: 'Latéral en forme cette saison' },
    { key: 'ajayi', name: 'Semi Ajayi', club: 'Hull City', pos: 'D', price: 4.4, own: 5.9, src: S_ARTICLE, form: 'Arrière-garde Hull en forme' },
    { key: 'gakpo', name: 'Cody Gakpo', club: 'Liverpool', pos: 'M', price: 7.7, own: 6.4, src: S_ARTICLE, form: 'Un des joueurs en forme du jeu (dernier mois)' },
    { key: 'rogers', name: 'Morgan Rogers', club: 'Chelsea', pos: 'M', price: 7.4, own: 16.0, src: S_ARTICLE, form: 'Impliqué dans les buts en série depuis son transfert' },
    { key: 'elanga', name: 'Anthony Elanga', club: 'Newcastle United', pos: 'M', price: 5.3, own: 8.7, src: S_ARTICLE, form: 'Ailier en forme à prix cassé' },
    { key: 'joaopedro', name: 'João Pedro', club: 'Chelsea', pos: 'A', price: 7.9, own: 38.2, src: S_ARTICLE, form: 'L’attaquant en forme de toute la division' },
  ]

  for (const p of players) {
    const created = await db.player.create({
      data: {
        name: p.name,
        club: p.club,
        clubConfirmed: p.clubConfirmed ?? true,
        position: p.pos,
        price: p.price ?? null,
        ownership: p.own ?? null,
        priceSource: p.src ?? null,
        formNote: p.form ?? null,
      },
    })
    if (p.role) {
      await db.squadSlot.create({
        data: {
          playerId: created.id,
          role: p.role,
          slotPosition: p.pos,
          captain: p.captain ?? false,
          round: 4,
          pointsR4: p.ptsR4 ?? null,
          pointsNote: p.ptsNote ?? null,
        },
      })
    }
  }

  // ── Fixtures réelles R5→R8 (article officiel ; R4 pour référence) ──
  type F = { round: number; club: string; opp: string; home: boolean }
  const fx: F[] = [
    // R4 (référence)
    { round: 4, club: 'Arsenal', opp: 'Sunderland', home: false },
    { round: 4, club: 'Manchester City', opp: 'Manchester United', home: false },
    { round: 4, club: 'Chelsea', opp: 'Hull City', home: true },
    { round: 4, club: 'Newcastle United', opp: 'Leeds United', home: false },
    { round: 4, club: 'Liverpool', opp: 'Fulham', home: true },
    // R5
    { round: 5, club: 'Arsenal', opp: 'Brighton', home: false },
    { round: 5, club: 'Manchester City', opp: 'Sunderland', home: true },
    { round: 5, club: 'Chelsea', opp: 'Brentford', home: false },
    { round: 5, club: 'Newcastle United', opp: 'Hull City', home: true },
    { round: 5, club: 'Liverpool', opp: 'Bournemouth', home: false },
    // R6
    { round: 6, club: 'Arsenal', opp: 'Leeds United', home: true },
    { round: 6, club: 'Manchester City', opp: 'Liverpool', home: false },
    { round: 6, club: 'Chelsea', opp: 'Bournemouth', home: true },
    { round: 6, club: 'Newcastle United', opp: 'Coventry City', home: false },
    { round: 6, club: 'Liverpool', opp: 'Manchester City', home: true },
    // R7
    { round: 7, club: 'Arsenal', opp: 'Nottm Forest', home: false },
    { round: 7, club: 'Manchester City', opp: 'Ipswich Town', home: true },
    { round: 7, club: 'Chelsea', opp: 'Everton', home: false },
    { round: 7, club: 'Newcastle United', opp: 'Aston Villa', home: true },
    { round: 7, club: 'Liverpool', opp: 'Brentford', home: false },
    // R8
    { round: 8, club: 'Arsenal', opp: 'Everton', home: true },
    { round: 8, club: 'Manchester City', opp: 'Aston Villa', home: false },
    { round: 8, club: 'Chelsea', opp: 'Tottenham', home: true },
    { round: 8, club: 'Newcastle United', opp: 'Crystal Palace', home: false },
    { round: 8, club: 'Liverpool', opp: 'Brighton', home: false },
  ]
  for (const f of fx) {
    await db.fixture.create({
      data: { round: f.round, club: f.club, opponent: f.opp, isHome: f.home, source: S_ARTICLE },
    })
  }

  // ── Journal d'ingestion ────────────────────────────────────
  const events = [
    { at: '2026-08-28T00:00:00Z', kind: 'REGLE', title: 'Règles officielles 2026/27 vérifiées', detail: 'Article officiel « What\'s New This Season » : 100M€, 15 joueurs (2G/5D/5M/3A), 2 transferts gratuits/journée (report max 5, extra −5 pts), Triple Captain ×3 (×1), Quick Fix (×2), Rebuild Squad (×2, 1 par mi-saison), max 1 token/journée. Scoring : ratings Sofascore + 30+ catégories.' },
    { at: '2026-09-11T00:00:00Z', kind: 'ARTICLE', title: 'Marché réel R4 (15 prix + ownership)', detail: 'Article officiel « Premier League Fantasy Picks: Round 4 » : Raya 6,6M€/28,8% · Haaland 12M€/75,5% · João Pedro 7,9M€/38,2% · Szoboszlai 8M€/21,6% · Gvardiol 6,8M€/17,4% · Rogers 7,4M€/16% · Ødegaard 7,8M€/9,7% · Hall 5,8M€/11,1% · Trafford 4,6M€/11,2% · Elanga 5,3M€/8,7% · Wissa 5,7M€/12,4% · Gakpo 7,7M€/6,4% · Ajayi 4,4M€/5,9% · White 5,2M€/4,5% · Egan 4,2M€/2,5%. Squad officiel = 99,4M€. Fixtures R4→R8 publiées.' },
    { at: '2026-09-13T21:22:00Z', kind: 'CAPTURE', title: 'Capture « Ligues » — classement réel', detail: 'Le fond de la classe après R4 : nik Leroy 333 (R4 : 108) · Donatien_10 318 · Aziza FC 295 · Vital_GDB 284 · Zarés JR 283.' },
    { at: '2026-09-13T21:45:00Z', kind: 'CAPTURE', title: 'Capture « Mon équipe » — XI réel R4 de Vital_GDB', detail: 'R1 71 · R2 66 · R3 76 · R4 en cours 71 (moyenne ligue 64,1). XI 3-5-2 : Raya 16, Guéhi 8, Justin (match à venir), Khusanov 0, Tavernier 10, Rice 8, Szoboszlai 6, Ødegaard 6, Fernandes 4, Haaland 18 (C), Wissa (en direct). Banc : Matthews 0, Lacroix 1, Akpom 0, Egan 1. Contrôle : 71+66+76+71 = 284 = total officiel au classement ✓' },
    { at: '2026-09-14T00:00:00Z', kind: 'SAISON', title: 'Dates des journées suivantes (capture)', detail: 'R5 : 18 sept. · R6 : 10 oct. · R7 : 17 oct. · R8 : 23 oct. (affichage officiel dans l’app).' },
  ]
  for (const e of events) await db.dataEvent.create({ data: e })

  console.log('Seed réel terminé :')
  console.log(' - 1 ligue, 5 managers, 8 RoundScore sourcés')
  console.log(` - ${await db.player.count()} joueurs (${await db.squadSlot.count()} dans l'effectif Vital_GDB)`)
  console.log(` - ${await db.fixture.count()} fixtures officielles R4-R8`)
  console.log(` - ${await db.dataEvent.count()} événements de traçabilité`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
