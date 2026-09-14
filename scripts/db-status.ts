import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const players = await db.player.count()
  const fixtureCount = await db.fixture.count()
  const roundsMax = (await db.fixture.aggregate({ _max: { round: true } }))._max.round
  const slots = await db.squadSlot.count()
  const rounds = await db.roundScore.count()
  const managers = await db.manager.findMany({ select: { name: true, isUser: true } })
  const sync = await db.syncState.findMany()
  const sample = await db.fixture.findMany({ orderBy: { round: 'asc' }, take: 4 })
  console.log(JSON.stringify({ players, fixtureCount, roundsMax, slots, rounds, managers, sync, sample }, null, 1))
}

main()
  .catch((e) => { console.error('ERR:', e.message); process.exitCode = 1 })
  .finally(() => db.$disconnect())
