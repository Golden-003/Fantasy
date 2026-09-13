// Règles officielles 2026/27 — vérifiées via l'article officiel Sofascore
// « Sofascore Fantasy 2026/27: What's New This Season » (28/08/2026)
// Fichier sans dépendance serveur : utilisable côté client.

export const RULES = {
  budget: 100,
  squadSize: 15,
  quota: { G: 2, D: 5, M: 5, A: 3 } as Record<string, number>,
  freeTransfersPerRound: 2,
  transferBankMax: 5,
  extraTransferPenalty: 5,
  captainMultiplier: 2,
  tokens: [
    { name: 'Triple Captain', effect: 'Capitaine ×3 au lieu de ×2', perSeason: 1, note: null as string | null },
    { name: 'Quick Fix', effect: 'Transfert supplémentaire sans pénalité', perSeason: 2, note: null as string | null },
    { name: 'Rebuild Squad', effect: 'Refonte de l’effectif', perSeason: 2, note: '1 par mi-saison' },
  ],
  maxOneTokenPerRound: true,
  scoringNote:
    'Points basés sur les ratings Sofascore + 30+ catégories statistiques. Changements 2026/27 : dégagements 6 = 1 pt, les passes ne marquent plus pour les défenseurs, pénalité pertes de balle dès 4, dribbles 3 = 1 pt, seuils GK (arrêts/dégagements) à 3.',
}

export const ROUND_DATES: Record<number, string> = {
  5: '18 sept. 2026',
  6: '10 oct. 2026',
  7: '17 oct. 2026',
  8: '23 oct. 2026',
}

export const SOURCES = {
  captures: 'Captures de ton app Sofascore (13 sept 2026, 21:22 & 21:45)',
  articlePicks: 'Article officiel « Premier League Fantasy Picks: Round 4 » (11 sept 2026)',
  articleRules: "Article officiel « Sofascore Fantasy 2026/27: What's New » (28 août 2026)",
  faq: 'FAQ officielle Sofascore (helpscoutdocs)',
}
