import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
let totEnd = 0, totScore = 0;
for (let r = 1; r <= 4; r++) {
  const f = await db.fixture.findMany({ where: { round: r, isHome: true } });
  const e = f.filter(x => x.status === 'Ended').length, s = f.filter(x => x.homeGoals != null).length;
  totEnd += e; totScore += s;
  console.log(`J${r}: ${e}/10 Ended, ${s}/10 avec score`);
}
console.log(`=== TOTAL: ${totEnd}/40 matchs joués, ${totScore}/40 scores ===`);
const stach = await db.player.findFirst({ where: { name: { contains: 'Stach' } }, select: { name: true, club: true, goals: true, marketValue: true } });
console.log('Stach:', stach?.name, stach?.club, `${stach?.goals} but(s), ${Number(stach?.marketValue)/1e6}M€`);
const g = await db.player.aggregate({ _sum: { goals: true, assists: true } });
const gf: any = await db.$queryRawUnsafe(`SELECT SUM(gf) as t FROM "TeamStanding"`);
console.log('Buts joueurs:', g._sum.goals, '| passes:', g._sum.assists, '| 2xGF classement:', Number(gf[0].t));
await db.$disconnect();
