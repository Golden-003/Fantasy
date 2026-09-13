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

---
Task ID: 2
Agent: Super Z (main)
Task: Brancher le Fantasy Coach sur des DONNÉES 100% RÉELLES (équipe réelle, ligue privée réelle, API officielle FPL) — suppression totale des données fictives

Work Log:
- Testé la connectivité réelle : API officielle FPL (fantasy.premierleague.com/api) → HTTP 200, endpoints publics confirmés (bootstrap-static, fixtures, event/N/live, entry/N, entry/N/history, entry/N/event/GW/picks, leagues-classic/N/standings). Sofascore → HTTP 403 (pas d'API publique, bloque les serveurs)
- Nouveau schéma Prisma : table Settings unique (teamId, leagueId, cookie optionnel) — anciennes tables de données fictives supprimées (db push)
- Créé src/lib/fpl/client.ts : client FPL officiel typé + cache mémoire TTL (bootstrap 10 min, live 1 min si journée en cours, picks/ligue 3-5 min) + déduplication des requêtes en vol + retry 429/5xx
- Moteur coach v2 (src/lib/coach/engine.ts, ~600 lignes) entièrement réécrit sur le réel : projections J+1 (0.45×ep_next officiel + 0.35×forme + 0.2×PPG, × minutes × difficulté réelle × disponibilité), Fixture Score 5 JW (FDR officielle), verdicts 🟢🟡🔴 avec raisons chiffrées, 5 derniers matchs réels depuis event/live (note dérivée du BPS réel : 4+bps/10), plan de transferts (ventes motivées → cibles abordables avec gain net), alertes (risques effectif depuis news/statuts réels, opportunités, menaces rivaux), différentiels (0 rival dans la LIGUE RÉELLE), war room (compositions réelles des rivaux via picks publics, menaces, conseils), points LIVE de la journée en cours (multipliant capitaine inclus, matchs restants via flag started)
- API : /api/settings (GET/POST validation en direct contre l'API FPL : équipe doit exister ET être dans la ligue / DELETE), overview/players/fixtures/league/assistant recâblées, NEED_SETUP convention
- UI : SetupDialog (Team ID + League ID, instructions URL, cookie optionnel avancé, zéro mot de passe), onboarding hero, onglets Joueurs+Calendrier accessibles sans connexion (données réelles), bouton ⚙️ Réglages, badge LIVE rouge header, footer « Données 100% réelles : API officielle FPL • synchro », taille de ligue dynamique (/8), estimation transferts signalée « ~ »
- Bugs corrigés : ep_next est une STRING dans l'API réelle,Prisma client stale (redémarrage dev requis), live « remaining » sur flag started (FPL garde finished=false jusqu'à confirmation), accolade parasite PlayerDialog, threatLevel typé
- Test E2E réel (scripts/test-e2e.ts) : vraie équipe « Blades XI » (entry 525400) de la vraie ligue publique « The League of Champions » (398, 8 managers) → connexion validée, XI réel affiché, LIVE J4 67 pts réels, proj J5 ~67, capitaine suggéré Haaland, classement réel 8 équipes, rivaux avec menaces réelles, assistant IA réponse ancrée sur les données réelles, puis déconnexion propre
- Vérification navigateur (agent-browser) : onboarding, connexion via UI, Mon équipe (terrain + chips), War Room (classement + cartes rivaux), Assistant (réponse « Capitaine : Haaland 8.2 pts »), dialog Haaland (vraies stats xG 3.2/xA 0.5, 5 derniers matchs réels, calendrier J5→J11 authentique), viewport mobile 390px — aucune erreur console
- État final : réglages réinitialisés → l'utilisateur arrive sur l'onboarding pour connecter SA vraie équipe

Stage Summary:
- Le logiciel fonctionne désormais EXCLUSIVEMENT sur des données réelles : API officielle Fantasy Premier League
- L'utilisateur n'a besoin d'aucun mot de passe : Team ID (URL /entry/N/) + League ID (URL /leagues-classic/N/standings), cookie optionnel pour l'exactitude temps réel (/my-team)
- Fichiers clés : src/lib/fpl/client.ts, src/lib/coach/engine.ts, src/app/api/settings/route.ts, src/components/coach/SetupDialog.tsx, page.tsx rewirée
- Ancien seed de données fictives supprimé (scripts/seed.ts effacé, tables drop)
- Limites réelles documentées : Sofascore sans API publique (403) → notes dérivées du BPS FPL ; FT estimés sans cookie (signalés « ~ »)

---
Task ID: 1
Agent: Main agent (Super Z)
Task: Clarification FPL vs Sofascore Fantasy + test réel d'accès aux données Sofascore

Work Log:
- Test curl direct api.sofascore.com + www.sofascore.com/api/v1 → 403 Forbidden (Cloudflare)
- Test navigateur headless (agent-browser): pages web Sofascore OK, images OK, mais API → 403 "challenge" (Cloudflare Turnstile), persistant même après tentative de vérification humaine
- Page https://www.sofascore.com/fantasy existe, nécessite connexion (Google/Facebook/Apple) + challenge Cloudflare
- Web search: règles RÉELLES Sofascore Fantasy 2026/27 confirmées (€100M, 15 joueurs, 5 transferts gratuits/sem, +3/-2 note, tokens, 30+ catégories stats basées sur les ratings Sofascore)
- Fait la distinction claire: Sofascore Fantasy ≠ FPL (Fantasy Premier League) — l'utilisateur joue à Sofascore Fantasy

Stage Summary:
- VERDICT TECHNIQUE: API Sofascore protégée par Cloudflare Turnstile → inaccessible depuis un serveur/datacenter. Accès réaliste uniquement depuis la machine de l'utilisateur avec sa vraie session navigateur (connecteur local ou extension)
- Règles réelles du jeu 2026/27 documentées et sourcées (articles Sofascore août 2026)
- Prochaine étape: obtenir de l'utilisateur nom de ligue/équipe/rivaux + préparer l'architecture connecteur local
