/**
 * Test direct du moteur analyste (sans passer par ZAI).
 * Usage: DATABASE_URL=... bun scripts/test_analyst.ts
 */
const QUESTIONS = [
  'classement de Premier League',
  'resultats de la derniere journee',
  'qui joue la J5 ?',
  'top buteurs',
  'Haaland vaut quoi ?',
  'forme de Leeds',
  'capitaine ?',
  'transferts ?',
  'antony elanga c est qui',
]

async function main() {
  const { analystAnswer } = await import('../src/lib/coach/analyst')
  for (const q of QUESTIONS) {
    const r = await analystAnswer(q)
    console.log(`\n──── Q: ${q}`)
    console.log(r.reply.slice(0, 700))
    console.log(`[intent: ${r.intent}]`)
  }
}
main()
