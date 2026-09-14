/**
 * SYNC CLI — appelle le module partagé src/lib/coach/fplsync.ts
 * (même logique que l'endpoint /api/sync temps réel)
 */
import { runSync } from '../src/lib/coach/fplsync'

runSync()
  .then((r) => {
    console.log(`Joueurs : ${r.playersUpdated} mis à jour (dont ${r.sourcedEnriched} sourcés Sofascore enrichis), ${r.playersCreated} créés`)
    console.log(`Fixtures : ${r.fixturesWritten} lignes (380 matchs × 2 côtés) — journée courante J${r.currentRound}`)
    console.log(`Durée : ${(r.durationMs / 1000).toFixed(1)} s`)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
