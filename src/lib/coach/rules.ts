// Règles officielles 2026/27 — fichier sans dépendance serveur, utilisable côté client.

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
}

// Les dates et le numéro de journée courante sont lus dynamiquement
// depuis la base (SyncState + fixtures kickoff) côté serveur.
