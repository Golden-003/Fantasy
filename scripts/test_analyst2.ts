import { analystAnswer } from '../src/lib/coach/analyst'
const QS = process.argv.slice(2)
async function main() {
  for (const q of QS) {
    const t0 = Date.now()
    const r = await analystAnswer(q)
    console.log(`\n──── Q: ${q} (${Date.now() - t0}ms) [${r.intent}]`)
    console.log(r.reply.slice(0, 550))
  }
  process.exit(0)
}
main()
