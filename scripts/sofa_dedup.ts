/**
 * DÉDUPlication joueurs : fusionne FPL (nom court) et Sofascore (nom complet).
 * Garde la ligne Sofascore (données réelles), transfère les références (slots, live, transfers)
 * et préserve prix/ownership/epNext FPL si absents côté Sofascore.
 */
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '')

async function main() {
  const players = await db.player.findMany()
  const sofa = players.filter((p) => p.sofascoreId)
  const others = players.filter((p) => !p.sofascoreId)

  const lastName = (n: string) => norm(n.split(/\s+/).pop() ?? n)
  const merges: { keepId: string; dropId: string; name: string }[] = []

  for (const s of sofa) {
    for (const o of others) {
      if (o.club !== s.club) continue
      const sn = norm(s.name), on = norm(o.name)
      const sameName = sn === on || sn.includes(on) || on.includes(sn) ||
        (lastName(s.name) === lastName(o.name) && s.position === o.position)
      if (!sameName) continue
      // garde le Sofascore, drop le FPL
      merges.push({ keepId: s.id, dropId: o.id, name: `${s.name} ← ${o.name}` })
    }
  }

  console.log(`${merges.length} fusions à faire:`)
  for (const m of merges) console.log(`   ${m.name}`)

  for (const m of merges) {
    // préserve les stats FPL manquantes sur la cible (sans violer fplId unique)
    const keep = await db.player.findUnique({ where: { id: m.keepId } })
    const drop = await db.player.findUnique({ where: { id: m.dropId } })
    if (!keep || !drop) continue
    let fplIdToSet = keep.fplId ?? null
    if (!fplIdToSet && drop.fplId) {
      const clash = await db.player.findFirst({ where: { fplId: drop.fplId, id: { notIn: [m.keepId, m.dropId] } } })
      if (!clash) fplIdToSet = drop.fplId
    }
    // 1) transfère les références SANS violer les contraintes uniques
    const dropSlots = await db.squadSlot.findMany({ where: { playerId: m.dropId } })
    for (const slot of dropSlots) {
      const exists = await db.squadSlot.findFirst({ where: { managerId: slot.managerId, playerId: m.keepId } })
      if (exists) await db.squadSlot.delete({ where: { id: slot.id } })
      else await db.squadSlot.update({ where: { id: slot.id }, data: { playerId: m.keepId } })
    }
    await db.liveEntry.updateMany({ where: { playerId: m.dropId }, data: { playerId: m.keepId } })
    await db.transfer.updateMany({ where: { outPlayerId: m.dropId }, data: { outPlayerId: m.keepId } })
    await db.transfer.updateMany({ where: { inPlayerId: m.dropId }, data: { inPlayerId: m.keepId } })
    // 2) supprime le doublon AVANT d'attribuer son fplId au keep (évite la violation unique)
    await db.player.delete({ where: { id: m.dropId } })
    // 3) enrichit la cible
    await db.player.update({
      where: { id: m.keepId },
      data: {
        price: keep.price ?? drop.price,
        priceSource: keep.priceSource ?? drop.priceSource,
        ownership: keep.ownership ?? drop.ownership,
        form: keep.form ?? drop.form,
        totalPoints: keep.totalPoints ?? drop.totalPoints,
        minutes: keep.minutes ?? drop.minutes,
        xg: keep.xg ?? drop.xg,
        xa: keep.xa ?? drop.xa,
        epNext: keep.epNext ?? drop.epNext,
        priceRef: keep.priceRef ?? drop.priceRef,
        ownershipRef: keep.ownershipRef ?? drop.ownershipRef,
        fplId: fplIdToSet,
        news: keep.news ?? drop.news,
        status: keep.status === 'DISPO' ? drop.status === 'ABSENT' || drop.status === 'DOUTEUX' ? drop.status : keep.status : keep.status,
      },
    })
  }

  const after = await db.player.count()
  const withGoals = await db.player.count({ where: { goals: { gt: 0 } } })
  const withMV = await db.player.count({ where: { marketValue: { not: null } } })
  console.log(`\n✅ Après fusion: ${after} joueurs (${withGoals} buteurs réels, ${withMV} avec valeur marché)`)
}

main()
  .catch((e) => { console.error('ERREUR:', e); process.exitCode = 1 })
  .finally(() => db.$disconnect())
