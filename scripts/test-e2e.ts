// Test E2E réel : prend une vraie équipe d'une vraie ligue publique FPL,
// connecte les réglages, teste overview / league / assistant, puis déconnecte.
const API = 'http://localhost:3000'

async function j(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, init)
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function main() {
  // 1. Trouver une vraie équipe dans une ligue publique réelle
  const lg = await (await fetch('https://fantasy.premierleague.com/api/leagues-classic/398/standings/?page_new_entries=1&page_standings=1')).json()
  const first = lg.standings?.results?.[0]
  if (!first) throw new Error('Pas de résultat de ligue')
  console.log(`[1] Ligue réelle « ${lg.league.name} » — équipe test : ${first.entry_name} (entry ${first.entry}, ${first.total} pts)`)

  // 2. POST /api/settings
  const set = await j('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId: first.entry, leagueId: lg.league.id }),
  })
  console.log(`[2] settings POST ${set.status} →`, JSON.stringify(set.body))

  // 3. Overview (peut être long : bootstrap + live + rivaux)
  const t0 = Date.now()
  const ov = await j('/api/coach/overview')
  console.log(`[3] overview ${ov.status} en ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  if (ov.body?.me) {
    const m = ov.body.me
    console.log(`    Équipe : ${m.teamName} — ${m.ownerName} | banque ${m.bank}M | FT ${m.transfersLeft}${m.transfersExact ? '' : ' (est.)'} | total ${m.totalPoints} pts | rang ligue ${m.rank} | score ${m.squadScore}/100`)
    console.log(`    XI : ${m.starters.map((s: any) => s.player.name).join(', ')}`)
    console.log(`    Proj. J${ov.body.nextGw} : ~${m.projectedGwPoints} pts | capitaine suggéré : ${m.captainSuggestion?.name ?? 'actuel OK'} | live : ${JSON.stringify(ov.body.live)}`)
    console.log(`    Alertes : ${ov.body.alerts.length} | ventes : ${ov.body.transfers.sell.map((s: any) => s.player.name).join(', ') || '—'} | achats : ${ov.body.transfers.buy.slice(0, 3).map((b: any) => b.player.name).join(', ') || '—'} | saison : ${ov.body.seasonLabel}`)
  } else console.log('    ⚠️', JSON.stringify(ov.body))

  // 4. League (war room)
  const t1 = Date.now()
  const lgd = await j('/api/coach/league')
  console.log(`[4] league ${lgd.status} en ${((Date.now() - t1) / 1000).toFixed(1)}s`)
  if (lgd.body?.standings) {
    console.log(`    Ligue « ${lgd.body.leagueName} » : ${lgd.body.standings.map((s: any) => `${s.rank}.${s.teamName}(${s.totalPoints})`).join(' ')}`)
    console.log(`    Rivaux : ${lgd.body.rivals.length} | différentiels : ${lgd.body.differentials.slice(0, 4).map((d: any) => `${d.name}(${d.projection})`).join(', ')}`)
  } else console.log('    ⚠️', JSON.stringify(lgd.body))

  // 5. Assistant IA (contexte réel + z-ai)
  const t2 = Date.now()
  const as = await j('/api/coach/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Qui dois-je mettre capitaine cette journée et pourquoi ?', history: [] }),
  })
  console.log(`[5] assistant ${as.status} en ${((Date.now() - t2) / 1000).toFixed(1)}s`)
  if (as.body?.reply) console.log('    Réponse IA :', as.body.reply.slice(0, 400).replace(/\n/g, ' | '))
  else console.log('    ⚠️', JSON.stringify(as.body))

  // 6. Nettoyage : déconnexion
  const del = await j('/api/settings', { method: 'DELETE' })
  console.log(`[6] settings DELETE ${del.status}`, JSON.stringify(del.body))
}

main().catch((e) => {
  console.error('E2E FAILED:', e.message)
  process.exit(1)
})
