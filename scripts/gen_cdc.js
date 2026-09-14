// Cahier des Charges — Sofascore Fantasy Coach (FR)
// Recipe cover: R4 (Top Color Block) + palette GO-1 (Graphite Orange — PRD/proposal)
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, WidthType, BorderStyle,
  ShadingType, SectionType, TableLayoutType, TableOfContents, PageBreak,
  PageOrientation, NumberFormat, SimpleField, ImageRun,
} = require("docx");
const fs = require("fs");
const _imgSize = require("image-size");
const sizeOf = _imgSize.imageSize || _imgSize.default || _imgSize;

// ── Palette GO-1 ──
const P = {
  bg: "1A2330", accent: "D4875A",
  titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078",
  headingDark: "1A2330",
  table: { headerBg: "D4875A", headerText: "FFFFFF", accentLine: "D4875A", innerLine: "DDD0C8", surface: "F8F0EB" },
};
const F_HEAD = { ascii: "Times New Roman", eastAsia: "SimHei" };
const F_BODY = { ascii: "Times New Roman", eastAsia: "SimSun" };

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
const emptyPara = () => new Paragraph({ children: [] });

// ── Latin-aware title layout (design-system estimateTextWidth) ──
function estimateTextWidth(text, pt) {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const isCJK = (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF) ||
      (code >= 0x3000 && code <= 0x303F) || (code >= 0xFF00 && code <= 0xFFEF) ||
      (code >= 0x2E80 && code <= 0x2EFF);
    width += isCJK ? pt * 20 : pt * 11;
  }
  return width;
}
function splitTitleLinesLatin(title, maxWidthTwips, pt) {
  const words = title.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (!cur || estimateTextWidth(test, pt) <= maxWidthTwips) cur = test;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  let titlePt = preferredPt, lines = [title];
  while (titlePt >= minPt) {
    lines = splitTitleLinesLatin(title, maxWidthTwips, titlePt);
    if (lines.length <= 3 && lines.every(l => estimateTextWidth(l, titlePt) <= maxWidthTwips)) break;
    titlePt -= 2;
  }
  return { titlePt, titleLines: lines };
}

// ── Recipe R4: Top Color Block (single 16838 outer wrapper) ──
function buildCoverR4(config) {
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 26);
  const titleSize = titlePt * 2;

  const titleBlockHeight = titleLines.length * (titlePt * 23 + 200);
  const englishLabelH = config.englishLabel ? (9 * 23 + 500) : 0;
  const subtitleH = config.subtitle ? (12 * 23 + 200) : 0;
  const upperContentH = englishLabelH + titleBlockHeight + subtitleH;
  const UPPER_MIN = 7500;
  const UPPER_H = Math.max(UPPER_MIN, upperContentH + 1500 + 800);
  const DIVIDER_H = 60;

  const contentEstimate = englishLabelH + titleBlockHeight + subtitleH;
  const spacerIntrinsic = 280;
  const topSpacing = Math.max(UPPER_H - contentEstimate - spacerIntrinsic - 800, 400);

  const upperBlock = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: UPPER_H, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        verticalAlign: "top",
        margins: { left: padL, right: padR },
        children: [
          new Paragraph({ spacing: { before: topSpacing } }),
          config.englishLabel ? new Paragraph({
            spacing: { after: 500 },
            children: [new TextRun({ text: config.englishLabel.split("").join(" "),
              size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 60 })],
          }) : null,
          ...titleLines.map((line, i) => new Paragraph({
            spacing: { after: i < titleLines.length - 1 ? 100 : 200, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
            children: [new TextRun({ text: line, size: titleSize, bold: true,
              color: P.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
          })),
          config.subtitle ? new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor,
              font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
          }) : null,
        ].filter(Boolean),
      })],
    })],
  });

  const divider = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: DIVIDER_H, rule: "exact" },
      children: [new TableCell({ borders: noBorders,
        shading: { type: ShadingType.CLEAR, fill: P.accent }, children: [emptyPara()] })],
    })],
  });

  const lowerContent = [
    new Paragraph({ spacing: { before: 800 } }),
    ...(config.metaLines || []).map(line => new Paragraph({
      indent: { left: padL }, spacing: { after: 100 },
      children: [new TextRun({ text: line, size: 28, color: P.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    })),
    new Paragraph({ spacing: { before: 2000 } }),
    new Paragraph({
      indent: { left: padL },
      children: [
        new TextRun({ text: config.footerLeft || "", size: 22, color: "909090" }),
        new TextRun({ text: "          " }),
        new TextRun({ text: config.footerRight || "", size: 22, color: "909090" }),
      ],
    }),
  ];

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: "FFFFFF" }, borders: noBorders,
        verticalAlign: "top",
        children: [upperBlock, divider, ...lowerContent],
      })],
    })],
  })];
}

// ── Body helpers ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.headingDark, font: F_HEAD })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.headingDark, font: F_HEAD })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: P.headingDark, font: F_HEAD })],
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: opts.after !== undefined ? opts.after : 120 },
    keepNext: opts.keepNext || false,
    children: [new TextRun({ text, size: 24, color: "000000", font: F_BODY })],
  });
}
function bodyRuns(runs, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: opts.after !== undefined ? opts.after : 120 },
    children: runs,
  });
}
function b(text) { return new TextRun({ text, bold: true, size: 24, color: "000000", font: F_BODY }); }
function r(text) { return new TextRun({ text, size: 24, color: "000000", font: F_BODY }); }
function bullet(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    bullet: { level: 0 },
    spacing: { line: 312, after: opts.after !== undefined ? opts.after : 60 },
    children: [new TextRun({ text, size: 24, color: "000000", font: F_BODY })],
  });
}
function caption(text) {
  return new Paragraph({
    keepNext: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: "404040", font: F_BODY })],
  });
}
function makeTable(headers, rows, widths) {
  const headerRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: headers.map((text, i) => new TableCell({
      children: [new Paragraph({
        alignment: AlignmentType.LEFT, spacing: { line: 312 },
        children: [new TextRun({ text, bold: true, size: 21, color: P.table.headerText, font: F_BODY })],
      })],
      shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
      margins: { top: 70, bottom: 70, left: 120, right: 120 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    })),
  });
  const dataRows = rows.map((cells, ri) => new TableRow({
    cantSplit: true,
    children: cells.map((text, i) => new TableCell({
      children: [new Paragraph({
        alignment: AlignmentType.LEFT, spacing: { line: 312 },
        children: [new TextRun({ text: String(text), size: 21, color: "000000", font: F_BODY })],
      })],
      shading: ri % 2 === 0
        ? { type: ShadingType.CLEAR, fill: P.table.surface }
        : { type: ShadingType.CLEAR, fill: "FFFFFF" },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [headerRow, ...dataRows],
  });
}

// ══════════════ CHAPITRE 1 — RÉSUMÉ EXÉCUTIF ══════════════
const ch1 = [
  h1("1. Résumé exécutif"),
  bodyRuns([r("Le présent document fixe le cahier des charges complet du logiciel "), b("« Sofascore Fantasy Coach — Premier League »"), r(", un assistant décisionnel privé destiné à un unique manager de la ligue Fantasy « Le fond de la classe ». Le logiciel n'est ni un jeu ni une démonstration : il se connecte aux données réelles de Sofascore — la véritable équipe de l'utilisateur, les quatre équipes rivales, le classement réel de la ligue et les statistiques réelles de Premier League — pour produire des recommandations concrètes avant chaque échéance. Vingt-quatre points de spécification, répartis en quatre groupes (fondements, fonctionnalités, données et architecture, réalisation), constituent le cœur du document.")]),
  bodyRuns([r("Trois constats structurants ont été vérifiés en conditions réelles. Premièrement, les règles officielles de la saison 2026/27 ont été re-sourcées directement auprès de Sofascore le 28 août et le 11 septembre 2026, ce qui corrige les approximations antérieures : la ligue fonctionne avec "), b("2 transferts gratuits par journée"), r(" (et non 5, valeur propre au Fantasy MLS), un budget de 100 M€ et un effectif de 15 joueurs. Deuxièmement, la collecte automatisée depuis un serveur est impossible : l'API interne de Sofascore est protégée par Cloudflare (erreur 403 « challenge » confirmée par tests le 14 septembre 2026), ce qui impose un connecteur local exécuté sur la machine de l'utilisateur avec sa propre session. Troisièmement, la situation sportive est serrée : avec 284 points, l'équipe de l'utilisateur occupe la 4e place à 11 points du podium et à 1 point seulement du 5e — chaque décision de journée pèse directement sur le classement.")]),
  bodyRuns([r("La feuille de route propose une V1 opérationnelle en quatre jalons, calée sur l'échéance de la prochaine journée, puis deux phases d'enrichissement (prédictions probabilistes puis assistant IA connecté). Quatre décisions restent à valider par l'utilisateur pour lancer le développement ; elles sont listées au chapitre 6.")]),
];

// ══════════════ CHAPITRE 2 — LE JEU SUPPORT ══════════════
const ch2 = [
  h1("2. Le jeu support : Sofascore Fantasy Premier League 2026/27"),
  bodyRuns([r("Le référentiel du logiciel est exclusivement "), b("Sofascore Fantasy"), r(" — le jeu de l'application Sofascore — et non le jeu officiel « Fantasy Premier League » (FPL) hébergé sur premierleague.com, dont les règles, la devise et le barème diffèrent. Cette distinction est une exigence de première importance : les premières ébauches du projet avaient mélangé les deux référentiels, ce qui a produit des données erronées. Toutes les valeurs ci-dessous proviennent d'articles officiels Sofascore datés du 28 août 2026 (« Sofascore Fantasy 2026/27: Every Rule Change Explained ») et du 11 septembre 2026 (« Premier League Fantasy Picks: Round 4 »), ainsi que de la FAQ officielle Sofascore (sofascore.helpscoutdocs.com).")]),
  h2("2.1 Règles officielles de la saison 2026/27"),
  caption("Tableau 1 — Règles officielles vérifiées (sources Sofascore, août-septembre 2026)"),
  makeTable(
    ["Élément", "Règle officielle 2026/27"],
    [
      ["Budget", "100 M€ pour construire l'effectif"],
      ["Effectif", "15 joueurs : 2 gardiens, 5 défenseurs, 5 milieux, 3 attaquants"],
      ["Transferts gratuits", "2 par journée (doublés par rapport à 1 en 2025/26) ; report cumulable jusqu'à 5 maximum"],
      ["Transfert supplémentaire", "-5 points par mouvement au-delà des gratuits"],
      ["Token Triple Captain", "Le capitaine rapporte x3 au lieu de x2 ; 1 usage par saison"],
      ["Token Quick Fix", "Transferts illimités pour une journée, puis annulation ; 2 usages par saison (hausse officielle 2026/27)"],
      ["Token Rebuild Squad", "Transferts illimités avec conservation du nouveau squad ; 2 usages par saison, une par moitié"],
      ["Limite de tokens", "1 token maximum par journée"],
      ["Barème de points", "Basé sur les ratings Sofascore et plus de 30 catégories statistiques réelles"],
      ["Spécificité des journées", "Les journées Fantasy regroupent les matchs par date et peuvent différer des rondes des autres plateformes"],
    ],
    [30, 70]
  ),
  h2("2.2 Ce qui change en 2026/27 et pourquoi cela compte"),
  bodyRuns([r("La saison 2026/27 n'est pas une simple reprise : Sofascore parle d'une « véritable refonte ». Les dégagements marquent désormais des points (6 dégagements = 1 point, puis 1 point supplémentaire par tranche de 6), ce qui récompense les défenseurs qui multiplient les interventions propres. À l'inverse, "), b("les passes ne rapportent plus rien aux défenseurs"), r(" : un arrière latéral qui monopolise le ballon sans trancher ne nourrit plus son score. Les dribbles ont été durcis (3 dribbles = 1 point, contre 1 dribble par point auparavant), la pénalité de perte de balle ne se déclenche qu'à partir de la 4e perte, et les seuils gardiens pour les sorties et reprises aériennes passent à 3. Ensemble, ces ajustements déplacent la valeur des effectifs vers le rendement concret et la substance défensive, au détriment des statistiques de volume.")]),
  bodyRuns([r("Côté gestion, le passage de 1 à 2 transferts gratuits par journée, cumulables jusqu'à 5, donne une vraie marge de manœuvre pour absorber une cascade de matchs ou une vague de blessures sans pénalité. Le doublement du token Quick Fix (désormais 2 par saison, aligné sur Rebuild Squad) réduit le coût d'une journée ratée. Le logiciel doit intégrer ces règles dans ses moteurs : par exemple, le module « Mon équipe » alerte quand le cumul de transferts atteint le plafond de 5, et le module de prédiction pondère les joueurs défensifs selon le nouveau barème. Les valeurs du marché réel de la journée 4 (Haaland 12 M€ détenu par 75,5 % des managers, João Pedro 7,9 M€ à 38,2 %, Raya 6,6 M€ à 28,8 %, Ben White 5,2 M€ à 4,5 %) serviront de données d'amorçage vérifiées pour la base joueurs.")]),
];

// ══════════════ CHAPITRE 3 — LA LIGUE CIBLE ══════════════
const ch3 = [
  h1("3. La ligue cible : « Le fond de la classe »"),
  bodyRuns([r("La ligue privée cible compte "), b("5 managers"), r(" et joue la saison 2026/27 de Sofascore Fantasy Premier League. Les données ci-dessous proviennent de la capture d'écran de l'application fournie par l'utilisateur le 13 septembre 2026 à 21 h 22 (dernière mise à jour de la ligue : 21 h 02), soit après la clôture de la journée 4. Ce tableau constitue l'état de référence : le logiciel doit retrouver exactement ces valeurs à chaque synchronisation.")]),
  h2("3.1 Classement réel au 13 septembre 2026"),
  caption("Tableau 2 — Classement de la ligue après la journée 4 (source : capture utilisateur, 13/09/2026)"),
  makeTable(
    ["Rang", "Équipe", "Manager", "Pts J4", "Total", "Tendance"],
    [
      ["1er", "nik Leroy", "nik Leroy", "108", "333", "+2 — badge « Top manager »"],
      ["2e", "Donatien Lokossou530", "Donatien_10", "83", "318", "-1"],
      ["3e", "Aziza FC", "Nadjib Américo", "65", "295", "-1"],
      ["4e", "Vital_GDB (équipe de l'utilisateur)", "Vital_GDB", "71", "284", "Équipe surlignée dans l'application"],
      ["5e", "Zarés JR", "Zarés Junior", "78", "283", "À 1 point de la 4e place"],
    ],
    [10, 26, 18, 10, 10, 26]
  ),
  body("La figure suivante visualise l'écart de points totaux après quatre journées, avec en surimpression les points marqués lors de la journée 4. Elle met en évidence la double dynamique de la ligue : une tête de course distendue et un milieu de table d'une densité extrême.", { keepNext: true }),
];

// Figure 1 — graphique du classement (PNG matplotlib 2000x1000, ratio 0.5)
const chartBuf = fs.readFileSync("/home/z/my-project/scripts/chart_ligue.png");
const dims = sizeOf(chartBuf);
const dispW = 560;
const dispH = Math.round(dispW * (dims.height / dims.width));

const fig1 = new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 80, after: 60 },
  children: [new ImageRun({ data: chartBuf, transformation: { width: dispW, height: dispH }, type: "png" })],
});
const fig1Caption = new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 160, line: 312 },
  children: [new TextRun({ text: "Figure 1 — Totals après 4 journées et points de la journée 4 (données réelles)", size: 21, color: "404040", font: F_BODY })],
});

const ch3b = [
  fig1,
  fig1Caption,
  h2("3.2 Lecture tactique de départ"),
  bodyRuns([r("Trois enseignements commandent la stratégie du logiciel. D'abord, l'écart avec le leader est substantiel : "), b("nik Leroy cumule 333 points, soit 49 de mieux que Vital_GDB"), r(", et a signé une journée 4 monstrueuse (108 points) qu'il faudra décortiquer dans le War Room — un tel total suggère un capitaine doublement payé (Triple Captain) ou un alignement exceptionnel, informations décisives pour anticiper ses prochains coups. Ensuite, le vrai combat de l'utilisateur est le podium : la 3e place (Aziza FC, 295 points) se situe à 11 points, distance rattrapable en deux ou trois bonnes journées. Enfin, la pression vient de derrière : Zarés JR n'est qu'à 1 point, ce qui interdit toute prise de risque inconsidérée — le logiciel devra arbitrer explicitement entre posture de chasseur (podium) et posture de défense (5e place).")]),
  bodyRuns([r("Le marché offre déjà des leviers concrets, documentés par les choix officiels de Sofascore pour la journée 4. Le tableau suivant retient les valeurs réelles publiées le 11 septembre 2026 : prix, pourcentage de possession dans le jeu et lecture. Ces données servent d'étalon initial au module Analyse joueurs ; elles seront rafraîchies à chaque synchronisation.")]),
  caption("Tableau 3 — Valeurs réelles du marché à la journée 4 (source : picks officiels Sofascore, 11/09/2026)"),
  makeTable(
    ["Joueur", "Équipe", "Prix", "Possession", "Lecture officielle"],
    [
      ["Erling Haaland", "Manchester City", "12,0 M€", "75,5 %", "Le plus cher et le plus détenu du jeu"],
      ["João Pedro", "Chelsea", "7,9 M€", "38,2 %", "L'attaquant en forme de toute la division"],
      ["David Raya", "Arsenal", "6,6 M€", "28,8 %", "Gardien le plus sélectionné, calendrier favorable"],
      ["Dominik Szoboszlai", "Liverpool", "8,0 M€", "21,6 %", "Source de points régulière, réception de Fulham"],
      ["Morgan Rogers", "Chelsea", "7,4 M€", "16,0 %", "Implication directe dans les buts depuis son transfert"],
      ["Joško Gvardiol", "Manchester City", "6,8 M€", "17,4 %", "Défenseur en forme, menace offensive ajoutée"],
      ["Cody Gakpo", "Liverpool", "7,7 M€", "6,4 %", "Parmi les joueurs en forme du mois — profil différentiel"],
      ["Ben White", "Arsenal", "5,2 M€", "4,5 %", "Meilleur rapport qualité/prix défensif actuel"],
    ],
    [20, 20, 10, 13, 37]
  ),
];

// ══════════════ CHAPITRE 4 — LES 24 POINTS ══════════════
const ch4 = [
  h1("4. Cahier des charges : les 24 points"),
  body("Les vingt-quatre points qui suivent constituent la spécification de référence du logiciel. Ils sont répartis en quatre groupes : fondements du projet (points 1 à 6), fonctionnalités (points 7 à 14), données réelles et architecture (points 15 à 21), réalisation (points 22 à 24). Chaque point est rédigé pour être vérifiable : une exigence floue doit être renvoyée pour clarification avant le développement."),

  h2("Groupe A — Fondements du projet (points 1 à 6)"),
  h3("Point 1 — Nom et identité du logiciel"),
  body("Le nom officiel est « Sofascore Fantasy Coach — Premier League », abrégé « SFC » dans l'interface. L'identité est celle d'un outil de coaching strictement privé : ton direct, ton factuel, zéro dimension ludique ou démonstrative. L'habillage visuel reprend les codes d'un tableau de bord analytique sobre, sans références au jeu lui-même au-delà des données affichées. Le nom complet figure sur la couverture, l'en-tête et l'écran d'accueil ; l'abréviation SFC est réservée aux espaces réduits (onglets, alertes, pied de page)."),
  h3("Point 2 — Vision et finalité"),
  body("La finalité du logiciel est de transformer les données réelles de Sofascore en décisions qui font gagner des points dans la ligue « Le fond de la classe » : compositions, choix de capitaine, transferts, tokens et arbitrages défensifs. Chaque fonctionnalité doit pouvoir être rattachée à un gain de points espéré ou à une réduction de risque mesurable — toute fonctionnalité qui ne satisfait pas ce test est écartée du périmètre. Le succès se mesure à une seule aiguille : la position au classement réel de la ligue, arrêtée à la 4e place (284 points) au 13 septembre 2026."),
  h3("Point 3 — Utilisateurs et périmètre"),
  body("Le logiciel sert un utilisateur unique : le manager de l'équipe Vital_GDB, 4e de la ligue avec 284 points. Les quatre autres équipes — nik Leroy (333 points), Donatien Lokossou530 (318), Aziza FC (295) et Zarés JR (283) — sont analysées en lecture seule, sans aucune possibilité d'écriture. Il n'existe ni inscription publique, ni multi-utilisateur, ni partage : le logiciel est strictement personnel. Les rattachements familiaux et amicaux des rivaux (frère, amis) seront saisis comme simple métadonnée d'affichage dans le War Room."),
  h3("Point 4 — Le jeu support et ses règles officielles"),
  body("Le référentiel est Sofascore Fantasy Premier League, saison 2026/27, avec les règles officielles détaillées au tableau 1 : budget de 100 M€, effectif de 15 joueurs (2 gardiens, 5 défenseurs, 5 milieux, 3 attaquants), 2 transferts gratuits par journée cumulables jusqu'à 5, pénalité de -5 points par transfert supplémentaire, et trois tokens limités à un par journée. Le barème repose sur les ratings Sofascore et plus de 30 catégories statistiques, avec les ajustements officiels de la saison (dégagements 6 pour 1 point, dribbles 3 pour 1 point, passes non rémunérées pour les défenseurs). Toute règle du logiciel dérive de ce référentiel daté et sourcé ; toute divergence constatée en cours de saison déclenche une mise à jour documentée."),
  h3("Point 5 — La ligue cible « Le fond de la classe »"),
  body("La ligue cible compte cinq managers et sert d'environnement de vérité au logiciel : le classement réel au 13 septembre 2026 (333, 318, 295, 284 et 283 points) est l'état de référence que l'application doit retrouver à l'identique lors de la première synchronisation. Les spécificités des journées Fantasy de Sofascore — regroupement des matchs par date, journées doubles ou vides différentes des autres plateformes — doivent être respectées dans tous les calculs de calendrier. La ligue est identifiée de manière unique dans la base pour éviter toute confusion avec une autre compétition Sofascore de l'utilisateur."),
  h3("Point 6 — Principes directeurs"),
  body("Quatre principes non négociables encadrent toute réalisation. Premièrement, zéro donnée fictive : toute valeur affichée est traçable vers une source datée (session Sofascore, article officiel ou capture validée). Deuxièmement, interprétation systématique : un chiffre ne sort jamais seul, chaque présentation porte un verdict en trois niveaux — bon investissement, à surveiller, à éviter. Troisièmement, unicité des données : l'assistant IA lit exactement la même base que l'interface, sans source parallèle. Quatrièmement, décision actionnable : chaque écran répond à une question concrète de management (« qui aligner ? », « qui transférer ? », « quel token ? »)."),

  h2("Groupe B — Fonctionnalités (points 7 à 14)"),
  h3("Point 7 — Module « Mon équipe »"),
  body("Ce module affiche l'état réel et complet de l'équipe : le onze de départ, le banc, le capitaine, le budget restant, les transferts disponibles et leur cumul vers le plafond de 5, la valeur totale de l'effectif et les tokens encore disponibles (Triple Captain, Quick Fix, Rebuild Squad). Chaque consultation produit un diagnostic daté : note d'équipe, forces du moment, risques immédiats (blessures, suspensions, doublons de calendrier) et les trois actions prioritaires à réaliser avant la deadline de la journée. C'est l'écran d'entrée du logiciel et celui qui doit être juste à cent pour cent dès la première synchronisation."),
  h3("Point 8 — Analyse joueurs"),
  body("Pour chaque joueur de Premier League, le module agrège : rating Sofascore moyen, performances des cinq derniers matchs, buts attendus (xG) et passes décisives attendus (xA), grosses occasions créées, passes clés, dégagements et dribbles réussis selon le nouveau barème 2026/27, prix courant et pourcentage de possession dans le jeu. Le verdict normalisé en trois niveaux — bon investissement, à surveiller, à éviter — est obligatoire et toujours justifié par au moins deux données réelles datées. Les filtres couvrent le poste, la fourchette de prix, la forme et la possession, afin de répondre en quelques secondes à la question « avec qui remplacer X dans mon budget ? »."),
  h3("Point 9 — Prédictions Fantasy Score"),
  body("Le moteur produit, pour chaque joueur et chaque journée à venir, un score projeté issu du trio forme récente, temps de jeu probable et difficulté de l'adversaire. La prédiction est présentée avec une probabilité de titularisation — un joueur est considéré comme titulaire probable au-delà de 75 pour cent — et une fourchette haute-basse explicite ; aucune valeur unique n'est jamais présentée comme certaine. Les paramètres du modèle (poids de la forme, de la rotation et du calendrier) restent visibles et ajustables, afin que chaque projection puisse être comprise, contestée et affinée par l'utilisateur."),
  h3("Point 10 — Calendrier et Fixture Score"),
  body("Le module calcule, pour les cinq prochaines journées, un score de facilité par équipe et par joueur, un cumul glissant et un classement des calendriers de toute la ligue. La référence de départ est officielle : Arsenal possède le calendrier le plus clément des rondes 4 à 8 (déplacements à Sunderland et Brighton, réceptions de Leeds et Everton), devant Manchester City, Chelsea, Newcastle et Liverpool. Le Fixture Score alimente directement les autres modules : recommandations de transferts, choix de capitaine et détection des doublons de joueurs à écouler avant une série difficile."),
  h3("Point 11 — Moteur d'alertes"),
  body("Les alertes se répartissent en deux familles : opportunités (joueur en forme sous-valorisé, calendrier qui s'ouvre, prix bas exploitable, token pertinent) et risques (blessure, rotation probable, suspension, baisse continue de rating, cumul de transferts au plafond). Chaque alerte porte un niveau de gravité, une échéance — systématiquement rattachée à la deadline de la journée en cours — et une action recommandée en une phrase. Le moteur fonctionne en local, sans notification serveur, et conserve un historique consultable pour évaluer la qualité de ses propres signaux."),
  h3("Point 12 — League War Room"),
  body("Le War Room consacre un écran à chacun des quatre rivaux : nik Leroy, Donatien_10, Nadjib Américo et Zarés Junior. Pour chacun : effectif reconstitué, points par journée, tendances, chevauchements avec mon effectif, capitaines probables et historique des mouvements de transferts. L'objectif est double : anticiper leurs coups avant la deadline et éviter de leur offrir des points — notamment en évitant de capitainer un joueur qu'ils détiennent massivement lorsqu'ils sont en position de force. La journée 4 de nik Leroy (108 points) fait l'objet d'une analyse inaugurale dès la première version du module."),
  h3("Point 13 — Differential Finder"),
  body("Dans une ligue de cinq personnes, l'avantage se joue entre rivaux directs : un joueur détenu par personne ne rapporte aucun différentiel. Le module classe donc les joueurs peu possédés par les quatre rivaux — idéalement sous 10 pour cent chez eux — dont la forme récente et le calendrier justifient un pari. Le score de différentiel combine trois facteurs : forme, fixture et faible détention chez les rivaux, selon la formule forme x fixture x (1 - possession chez les rivaux). Le module interdit explicitement les paris différentiels lorsque l'écart de points avec Zarés JR (1 point d'avance) rend le risque inconsidéré."),
  h3("Point 14 — Assistant IA connecté"),
  body("L'assistant est un chat branché sur exactement la même base de données que l'interface : il répond à « je fais jouer qui ? », « qui capitainer ? », « je vends qui ? » en citant les ratings, fixtures, probabilités et prix réels de l'effectif de l'utilisateur et des rivaux. Aucune réponse générique n'est tolérée : si une donnée manque, l'assistant le dit et propose la synchronisation ou la capture nécessaire. Chaque recommandation liste ses sources internes (tables et dates), ce qui permet de vérifier le raisonnement à posteriori — dans l'esprit du principe d'unicité des données fixé au point 6."),

  h2("Groupe C — Données réelles et architecture (points 15 à 21)"),
  h3("Point 15 — Sources de données réelles"),
  body("Le logiciel s'alimente auprès de trois flux distincts et datés. Le flux « jeu » provient de la session Sofascore de l'utilisateur : mon équipe, la ligue « Le fond de la classe », les quatre équipes rivales, les transferts et tokens. Le flux « statistiques » couvre les matchs, ratings, xG/xA et calendriers de Premier League publiés par Sofascore. Le flux « référentiel » rassemble les règles officielles de la saison, issues des articles Sofascore du 28 août et du 11 septembre 2026 et de la FAQ officielle. Chaque enregistrement stocke sa source et sa date, ce qui rend possible l'exigence de traçabilité du point 6."),
  h3("Point 16 — Constat d'accès du 14 septembre 2026"),
  body("Des tests d'accès ont été exécutés le 14 septembre 2026 depuis un environnement serveur. L'API interne de Sofascore (api.sofascore.com et www.sofascore.com/api/v1) renvoie systématiquement une erreur 403 « challenge » protégée par Cloudflare, y compris via un navigateur automatisé complet ; la page Fantasy et les pages de profil exigent une connexion active ; seules les pages publiques et les articles sont lisibles. Conclusion technique ferme : toute collecte serveur est vouée à l'échec, et la collecte fiable s'exécute du côté de l'utilisateur, sur son réseau et avec sa session. Ce constat conditionne l'architecture complète du projet."),
  h3("Point 17 — Connecteur local (option retenue)"),
  body("Le mode de collecte principal est un connecteur local : un petit service installé sur la machine de l'utilisateur, qui réutilise la session de son navigateur déjà connectée à Sofascore pour lire mon équipe, la ligue et les équipes rivales, puis les injecte dans la base locale. Aucun mot de passe n'est demandé, transmis ou stocké par le logiciel ; seules des données de jeu sont enregistrées, localement. Le connecteur s'exécute à la demande (bouton « Synchroniser ») ou selon un calendrier léger avant chaque deadline, avec un rythme de requêtes volontairement modéré."),
  h3("Point 18 — Options de repli"),
  body("Deux modes de secours partagent le même format d'échange que le connecteur principal, si bien que le logiciel fonctionne quel que soit le canal utilisé. L'option B est une extension de navigateur qui capte les mêmes données pendant la navigation normale de l'utilisateur sur Sofascore — utile si le connecteur local rencontre une restriction technique. L'option C est un import manuel assisté : captures d'écran structurées ou fichiers JSON collés dans un formulaire guidé, suffisants pour tenir une journée complète en cas d'indisponibilité des deux premiers canaux. Le basculement entre canaux ne modifie ni la base, ni les moteurs, ni l'interface."),
  h3("Point 19 — Normalisation et base de données"),
  body("Une couche de normalisation traduit les données brutes en un schéma stable : players, teams, fixtures, ratings, fantasy_squads, league_entries, alerts et decisions_log, stockées dans une base SQLite locale. Chaque table porte un horodatage et une référence de source, et conserve l'historique des valeurs successives — indispensable pour calculer les tendances (hausse de prix, baisse de rating) et pour auditer une recommandation passée. Les identifiants Sofascore des joueurs et des équipes sont conservés tels quels afin de garantir la correspondance exacte entre l'application et le logiciel."),
  h3("Point 20 — Moteurs analytiques"),
  body("Cinq moteurs indépendants et testables forment le cœur de calcul : le moteur de scoring Fantasy (barème officiel 2026/27), le moteur de fixtures (score de facilité sur cinq journées glissantes), le moteur de prédiction (score projeté, probabilité de titularisation, fourchette), le moteur de différentiel (forme x fixture x rareté chez les rivaux) et le moteur d'alertes (opportunités et risques pondérés). Chaque moteur expose publiquement ses formules dans l'interface — une info-bulle « comment ce chiffre est calculé » accompagne chaque valeur dérivée — de sorte qu'aucun calcul ne soit une boîte noire pour l'utilisateur."),
  h3("Point 21 — Sécurité et conformité"),
  body("Les cookies de session Sofascore restent sur la machine de l'utilisateur, stockés localement et chiffrés ; aucun identifiant, aucun mot de passe et aucune donnée personnelle ne transitent par un serveur tiers. Le rythme de requêtes est volontairement limité à un usage personnel raisonnable : quelques synchronisations par journée, pas de republication des données, pas d'usage commercial — conformément à l'esprit des conditions d'utilisation de Sofascore. Une fonction de suppression totale permet d'effacer la base et les sessions en une action. Enfin, le logiciel n'automatise aucune action de jeu : il recommande, l'utilisateur décide et agit lui-même dans l'application officielle."),

  h2("Groupe D — Réalisation (points 22 à 24)"),
  h3("Point 22 — Périmètre MVP V1"),
  body("La V1 couvre quatre modules : Mon équipe (état réel et diagnostic), Analyse joueurs en lecture, Calendrier et Fixture Score, et une War Room simplifiée (classement réel et effectifs des rivaux importés), le tout alimenté par le connecteur local et l'import manuel de secours. Sont explicitement exclus de la V1 : les prédictions probabilistes avancées, le différentiel automatisé et le chat IA — réservés aux phases V1.5 et V2. Ce resserrement vise une échéance précise : disposer d'un outil fiable avant la deadline de la prochaine journée, plutôt qu'un outil complet mais tardif."),
  h3("Point 23 — Roadmap et jalons"),
  body("Le projet avance en cinq jalons vérifiables. Jalon 0 : validation du présent cahier des charges et des quatre décisions du chapitre 6. Jalon 1 : connecteur local lisant réellement mon équipe et la ligue, avec première synchronisation de contrôle contre la capture du 13 septembre. Jalon 2 : base normalisée et modules Mon équipe et Calendrier opérationnels. Jalon 3 : War Room et moteur d'alertes. Jalon 4 : V1 utilisable avant la deadline de la journée 5. Les phases suivantes ajoutent la prédiction probabiliste (V1.5), puis le différentiel automatisé et l'assistant IA connecté (V2)."),
  h3("Point 24 — Critères d'acceptation"),
  body("La V1 est acceptée si cinq critères sont réunis. Premièrement, le onze affiché correspond exactement à l'application, sans aucune saisie manuelle. Deuxièmement, le classement affiché est identique à la capture de référence : 333, 318, 295, 284 et 283 points. Troisièmement, cent pour cent des recommandations sont justifiées par au moins deux données réelles datées. Quatrièmement, une synchronisation complète s'exécute en moins de cinq minutes sur la machine locale, y compris le premier lancement. Cinquièmement, aucun identifiant Sofascore n'est stocké par le logiciel, vérification faite de l'ensemble des fichiers créés en local."),
];

// ══════════════ CHAPITRE 5 — ACCÈS AUX DONNÉES RÉELLES ══════════════
const ch5 = [
  h1("5. Accès aux données réelles : constat et options"),
  bodyRuns([r("Ce chapitre traduit en décision d'architecture le constat technique du point 16. Il a été établi par des tests réels exécutés le 14 septembre 2026, résumés ci-dessous. Leur valeur est décisive : ils interdisent de bâtir le logiciel sur une hypothèse de collecte serveur qui échouerait dès le premier jour, et orientent toute l'architecture vers une exécution locale, du côté de l'utilisateur.")]),
  h2("5.1 Constat technique du 14 septembre 2026"),
  caption("Tableau 4 — Résultats des tests d'accès aux services Sofascore"),
  makeTable(
    ["Test exécuté", "Résultat observé", "Verdict"],
    [
      ["Appel direct à l'API (api.sofascore.com)", "HTTP 403 — Forbidden", "Bloqué"],
      ["API via domaine principal (www.sofascore.com/api/v1)", "HTTP 403 — raison « challenge » (Cloudflare Turnstile)", "Bloqué"],
      ["Navigateur automatisé complet sur les pages publiques", "Pages et articles chargés correctement", "Accessible"],
      ["API depuis le navigateur automatisé, après délai", "HTTP 403 « challenge » persistant", "Bloqué"],
      ["Écran Fantasy et page de profil utilisateur", "Mur de connexion (Google, Facebook, Apple) + challenge", "Réservé au compte"],
    ],
    [38, 40, 22]
  ),
  body("La lecture de ce tableau est sans ambiguïté : Sofascore protège activement son API contre les accès non navigateurs et les environnements serveurs, tout en laissant les pages publiques et les articles accessibles. Les données de jeu (équipe, ligue, rivaux) sont de surcroît placées derrière l'authentification du compte. Une architecture qui tenterait de collecter ces données depuis un serveur serait à la fois inefficace et inutilement agressive envers le service ; la bonne réponse est technique avant d'être diplomatique : collecter là où la session existe déjà, c'est-à-dire sur la machine de l'utilisateur."),
  h2("5.2 Trois options de collecte comparées"),
  caption("Tableau 5 — Comparaison des trois options de collecte des données réelles"),
  makeTable(
    ["Critère", "A. Connecteur local", "B. Extension navigateur", "C. Import manuel"],
    [
      ["Fiabilité face à Cloudflare", "Élevée — session et IP réelles de l'utilisateur", "Très élevée — trafic natif du navigateur", "Totale — aucune requête automatisée"],
      ["Effort de mise en place", "Moyen — service local + lecture de session", "Moyen — développement d'extension", "Faible — formulaire guidé"],
      ["Confort quotidien", "Élevé — bouton « Synchroniser »", "Élevé — passif pendant la navigation", "Limité — quelques minutes par journée"],
      ["Exposition des identifiants", "Aucune — pas de mot de passe manipulé", "Aucune", "Aucune"],
      ["Rôle dans le projet", "Canal principal retenu", "Repli technique", "Repli d'urgence"],
    ],
    [24, 27, 26, 23]
  ),
  body("L'option A combine deux avantages décisifs : la fiabilité d'une session authentique exécutée sur le réseau résidentiel de l'utilisateur, et un confort d'usage en un clic avant chaque deadline. L'option B est techniquement la plus robuste — le trafic provient du vrai navigateur, indistinguable d'une navigation normale — mais son développement est plus spécialisé ; elle reste le repli naturel si le connecteur se heurte à une évolution des protections. L'option C ne souffre d'aucune dépendance technique et garantit la continuité du service dans tous les cas, au prix de quelques minutes de saisie par journée ; c'est aussi le canal d'amorçage de la V1, le temps de valider le connecteur."),
  h2("5.3 Recommandation"),
  bodyRuns([r("Le projet retient "), b("le connecteur local comme canal principal"), r(", l'extension navigateur comme repli technique et l'import manuel comme filet de sécurité permanent. Trois précautions accompagnent ce choix : le connecteur n'utilise que la session déjà ouverte dans le navigateur de l'utilisateur — aucun mot de passe n'est jamais saisi dans le logiciel ; le rythme de requêtes reste volontairement bas (quelques synchronisations par journée), dans un usage strictement personnel des services Sofascore ; et l'utilisateur conserve un bouton de suppression totale de la base et des sessions. Cette configuration respecte le point 21 du cahier des charges et place la conformité au même niveau que la performance.")]),
];

// ══════════════ CHAPITRE 6 — VALIDATION ET PROCHAINES ÉTAPES ══════════════
const ch6 = [
  h1("6. Validation et prochaines étapes"),
  bodyRuns([r("Ce chapitre fixe les conditions de démarrage du développement. Le cahier des charges est considéré comme validé lorsque les quatre décisions ci-dessous sont confirmées par l'utilisateur ; le développement du jalon 1 (connecteur local et première synchronisation réelle) peut alors commencer immédiatement, l'objectif restant une V1 utilisable avant la deadline de la journée 5 de la ligue.")]),
  h2("6.1 Critères d'acceptation de la V1"),
  caption("Tableau 6 — Critères d'acceptation mesurables de la V1"),
  makeTable(
    ["N°", "Critère", "Seuil de validation"],
    [
      ["1", "Exactitude de l'équipe affichée", "Le onze, le banc et le capitaine correspondent à l'application, sans saisie manuelle"],
      ["2", "Exactitude du classement", "Valeurs identiques à la capture de référence : 333, 318, 295, 284, 283 points"],
      ["3", "Traçabilité des recommandations", "100 % des verdicts justifiés par au moins 2 données réelles datées"],
      ["4", "Performance de synchronisation", "Synchronisation complète en moins de 5 minutes, premier lancement inclus"],
      ["5", "Confidentialité", "Aucun identifiant Sofascore stocké, vérification de tous les fichiers locaux"],
    ],
    [8, 32, 60]
  ),
  h2("6.2 Décisions à valider par l'utilisateur"),
  body("Quatre décisions conditionnent le lancement. Elles sont listées avec leur valeur par défaut recommandée : un accord implicite sur les recommandations suffit à déclencher le jalon 1."),
  bullet("Décision 1 — Confirmer que votre équipe est bien Vital_GDB (4e, 284 points, équipe surlignée dans la capture du 13 septembre)."),
  bullet("Décision 2 — Préciser le rattachement des quatre rivaux pour le War Room : qui est votre frère, qui sont vos trois amis (nik Leroy, Donatien_10, Nadjib Américo, Zarés Junior)."),
  bullet("Décision 3 — Valider le connecteur local comme canal principal de collecte, avec l'extension navigateur et l'import manuel en repli (chapitre 5)."),
  bullet("Décision 4 — Envoyer une capture de l'écran « Mon équipe » de l'application (onze, banc, budget, transferts disponibles, tokens) pour amorcer la base réelle dès le jalon 1.", { after: 160 }),
  bodyRuns([r("Dès réception de ces confirmations, la séquence de travail est la suivante : mise en place du connecteur local sur votre machine, première synchronisation de contrôle contre la capture du 13 septembre 2026, puis construction des modules « Mon équipe » et « Calendrier » sur la base normalisée. Le War Room et les alertes suivent, en gardant une constante : "), b("chaque chiffre affiché proviendra d'une source réelle et datée"), r(", dans la continuité exacte des tableaux de ce document.")]),
];

// ══════════════ FRONT MATTER (TOC) ══════════════
const tocChildren = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360 },
    children: [new TextRun({ text: "Table des matières", bold: true, size: 32, color: P.headingDark, font: F_HEAD })],
  }),
  new TableOfContents("Table des matières", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({
      text: "Remarque : cette table des matières est générée par champ. Après toute modification du document, cliquez droit sur la table puis choisissez « Mettre à jour les champs » pour actualiser les numéros de page.",
      italics: true, size: 18, color: "888888", font: F_BODY,
    })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ══════════════ PAGE SETUP ══════════════
const pgSize = { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

function docHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 4 } },
      spacing: { after: 0 },
      children: [new TextRun({ text: "Sofascore Fantasy Coach — Cahier des Charges", size: 18, color: "808080", font: F_BODY })],
    })],
  });
}
function romanFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new SimpleField("PAGE \\* ROMAN \\* MERGEFORMAT")],
    })],
  });
}
function arabicFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new SimpleField("PAGE \\* arabic \\* MERGEFORMAT")],
    })],
  });
}

// ══════════════ DOCUMENT ══════════════
const doc = new Document({
  creator: "Sofascore Fantasy Coach",
  title: "Cahier des Charges — Sofascore Fantasy Coach — Premier League",
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: F_HEAD, size: 32, bold: true, color: P.headingDark },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: F_HEAD, size: 28, bold: true, color: P.headingDark },
        paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: F_HEAD, size: 24, bold: true, color: P.headingDark },
        paragraph: { spacing: { before: 200, after: 100, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    { // Section 1 — Couverture (marge 0, pas de pied de page)
      properties: {
        page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCoverR4({
        title: "Cahier des Charges",
        subtitle: "Sofascore Fantasy Coach — Premier League",
        englishLabel: "SOFA SCORE FANTASY COACH",
        metaLines: [
          "Projet : assistant décisionnel connecté aux données réelles",
          "Ligue privée : « Le fond de la classe » — 5 managers",
          "Saison : 2026/27 — Journée 4 en cours (au 13 septembre 2026)",
          "Version : 1.0 — Document de travail à valider",
        ],
        footerLeft: "Usage strictement personnel — confidentiel",
        footerRight: "14 septembre 2026",
      }),
    },
    { // Section 2 — Table des matières (numérotation romaine)
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: docHeader() },
      footers: { default: romanFooter() },
      children: tocChildren,
    },
    { // Section 3 — Corps (numérotation arabe, repart à 1)
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: docHeader() },
      footers: { default: arabicFooter() },
      children: [...ch1, ...ch2, ...ch3, ...ch3b, ...ch4, ...ch5, ...ch6],
    },
  ],
});

const OUT = "/home/z/my-project/download/Cahier_des_Charges_Sofascore_Fantasy_Coach.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("OK →", OUT, buf.length, "bytes");
}).catch(e => { console.error("FAIL", e); process.exit(1); });
