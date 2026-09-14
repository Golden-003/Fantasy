import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const rows = await db.fixture.findMany({ where: { round: 5, isHome: true }, orderBy: { club: 'asc' } })
for (const f of rows) console.log(`${f.club} vs ${f.opponent} → level ${f.difficulty}`)
await db.$disconnect()
