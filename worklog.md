# Worklog

---
Task ID: 1
Agent: Super Z (main)
Task: Construire « Fantasy Coach Premier League » — copilote web de coaching pour une ligue Sofascore Fantasy privée à 5 gestionnaires (V1)

Work Log:
- Initialisation de l'environnement fullstack (script init-fullstack, Next.js 16 + Tailwind 4 + shadcn/ui + Prisma/SQLite)
- Conception de l'architecture demandée : Data Provider → Normalisation → DB → Analytics (couche provider interchangeable, pas de dépendance à une API Sofascore non officielle)
- Schéma Prisma : Team (20 équipes PL), Player (183 joueurs réels, stats générées de façon déterministe), Fixture (calendrier round-robin 13 journées calé sur les samedis réels), FantasyTeam + SquadSlot (mon équipe + 4 rivaux)
- Seed (`scripts/seed.ts`) : PRNG déterministe par joueur, 5 derniers matchs, xG/xA, clean sheets, statuts (Rogers DOUBTFUL, Maddison INJURED, Saliba SUSPENDED), overrides narratifs (Semenyo UP, Grealish différentiel 9 %…)
- Moteur (`src/lib/coach/engine.ts`) : Fixture Score pondéré (5 GW), projection Fantasy Score (note+forme × minutes probables × difficulté × tendance × production réelle xG+xA, malus poste DEF/GK, amortissement qualité), verdicts 🟢🟡🔴 avec raisons FR, alertes (menaces rivaux, risques effectif, opportunités, formes), plan de transferts (ventes + cibles avec net gain), différentiels, war room
- API : /api/coach/overview, /players, /fixtures, /league, /assistant (POST, z-ai-web-dev-sdk côté serveur avec contexte moteur + repli rule-based)
- UI : 7 onglets (Mon Équipe avec terrain 4-4-2 cliquable, Joueurs avec filtres/tri, Transferts, Calendrier, Alertes, War Room, Assistant chat markdown), dialog détail joueur (stats complètes, 5 matchs, calendrier), design dark premium emerald, responsive mobile
- Calibrage moteur : correction du surclassement des joueurs moyens sur séries faciles (production pondérée + amortissement) → Salah 8,78 > Haaland 8,73 > Palmer 7,92 ; différentiels crédibles (Grealish 6,51)
- Bugs corrigés : id sans default dans le schéma, GK buteurs, reasons du verdict non assignées (dialog vide), lint setState synchrone dans useEffect, rendu markdown de l'assistant (react-markdown)
- Vérification navigateur (agent-browser) : navigation des 7 onglets, dialog Haaland, chat assistant (2 questions), viewport mobile 390px, footer sticky — aucune erreur console bloquante

Stage Summary:
- Livrable : application web « Fantasy Coach Premier League » fonctionnelle (port 3000, route /)
- Fichiers clés : prisma/schema.prisma, scripts/seed.ts, src/lib/coach/{types,engine}.ts, src/app/api/coach/**, src/components/coach/**, src/app/page.tsx
- Base : db/custom.db (183 joueurs, 130 matchs, 5 équipes fantasy) — relancer `bun scripts/seed.ts` pour régénérer
- Lint ✅, dev.log propre ✅, vérifié dans le navigateur ✅
