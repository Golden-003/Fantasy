/**
 * Injecte les notes réelles Sofascore (lastYearSummary) dans Player.
 * - lastYearAvg : note moyenne réelle sur les 12 derniers mois
 * - lastYearNotes : séries (notes par match, blessures) — utilisées par l'assistant
 */
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const notes: Record<string, { lastYearSummary: any[] | null; transfers: number }> = JSON.parse(
    readFileSync('/home/z/my-project/scripts/sofa_ckpt_players_notes.json', 'utf8'))
  const players = await db.player.findMany({ where: { sofascoreId: { not: null } }, select: { id: true, sofascoreId: true } })
  const bySofa = new Map(players.filter((p) => p.sofascoreId).map((p) => [p.sofascoreId!, p.id]))

  let updated = 0, avgSet = 0
  const batch: { id: string; avg: number | null; notes: any }[] = []
  for (const [sid, n] of Object.entries(notes)) {
    const pid = bySofa.get(Number(sid))
    if (!pid || !n?.lastYearSummary) continue
    const events = n.lastYearSummary.filter((e: any) => e.type === 'event' && e.value != null)
    const avg = events.length ? Math.round((events.reduce((a: number, e: any) => a + Number(e.value), 0) / events.length) * 10) / 10 : null
    batch.push({ id: pid, avg, notes: n.lastYearSummary.slice(-60) }) // garde les 60 derniers événements
    if (avg != null) avgSet++
  }

  for (const b of batch) {
    await db.player.update({
      where: { id: b.id },
      data: { lastYearAvg: b.avg, lastYearNotes: b.notes as any },
    })
    updated++
    if (updated % 100 === 0) console.log(`  ${updated}/${batch.length}`)
  }
  console.log(`✅ ${updated} joueurs enrichis (notes réelles), dont ${avgSet} avec moyenne 12 mois`)
}

main()
  .catch((e) => { console.error('ERREUR:', e); process.exitCode = 1 })
  .finally(() => db.$disconnect())
