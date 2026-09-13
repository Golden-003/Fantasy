import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { buildLeagueData, getCoachData, verdictEmoji } from '@/lib/coach/engine'

export const dynamic = 'force-dynamic'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const message: string | undefined = body?.message
    const history: ChatMessage[] = Array.isArray(body?.history) ? body.history.slice(-6) : []
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message manquant' }, { status: 400 })
    }

    // Contexte compact issu du moteur
    const data = await getCoachData()
    const league = buildLeagueData(data)
    const xi = data.me.starters.map((s) => {
      const p = s.player
      const fix = p.fixtures[0]
      return `${p.name} (${p.teamShort}, ${p.position}, ${p.price}M) proj ${p.projection} ${verdictEmoji(p.verdict)} ${s.isCaptain ? '[C]' : ''} vs ${fix ? fix.opp + (fix.venue === 'H' ? ' (D)' : ' (E)') : '?'}${p.status !== 'FIT' ? ' ⚠️ ' + p.status : ''}`
    })
    const bench = data.me.bench.map((p) => `${p.player.name} proj ${p.player.projection}`)
    const topBuy = data.transfers.buy.slice(0, 5).map((b) => `${b.player.name} (${b.player.teamShort}, ${b.player.price}M, proj ${b.player.projection}${b.differential ? ', DIFFÉRENTIEL' : ''}${b.comparedTo ? `, remplace ${b.comparedTo} pour +${b.netGain}` : ''})`)
    const topSell = data.transfers.sell.slice(0, 5).map((s) => `${s.player.name} (${s.reason})`)
    const alerts = data.alerts.slice(0, 6).map((a) => `${a.title} — ${a.detail}`)
    const rivals = league.rivals.map((r) => `${r.ownerName} (score ${r.squadScore}, menace ${r.threatLevel}, têtes : ${r.threats.map((t) => `${t.name} ${t.projection}`).join(', ')})`)
    const diffs = league.differentials.slice(0, 5).map((p) => `${p.name} (${p.teamShort}, ${p.price}M, proj ${p.projection}, ${p.ownership}% possédé)`)
    const capt = data.me.captainSuggestion

    const context = `Tu es le coach fantasy personnel de l'utilisateur dans sa ligue privée Sofascore Fantasy à 5 gestionnaires (Premier League 2026/27, journée ${data.nextGw} à venir).
Réponds en français, de façon directe, concise et actionnable (max ~180 mots). Utilise des emojis avec parcimonie (🟢🟡🔴💎🧢). Appuie-toi UNIQUEMENT sur les données du contexte ci-dessous pour les chiffres. Donne toujours une recommandation claire + les raisons (forme, minutes probables, calendrier, différentiel).

MON XI (projection J${data.nextGw}) :
${xi.join('\n')}
BANC : ${bench.join(', ')}
CAPITAINE ACTUEL : ${data.me.starters.find((s) => s.isCaptain)?.player.name ?? '?'}${capt ? ` — suggestion moteur : ${capt.name} (${capt.projection})` : ' — actuel = optimal'}
BANQUE : ${data.me.bank}M | TRANSFERTS RESTANTS : ${data.me.transfersLeft} | SCORE ÉQUIPE : ${data.me.squadScore}/100 | CLASSEMENT : ${data.me.rank}/5

MEILLEURES CIBLES TRANSFERT : ${topBuy.join(' | ') || '—'}
À VENDRE EN PRIORITÉ : ${topSell.join(' | ') || '—'}
ALERTES ACTIVES : ${alerts.join(' • ') || '—'}
RIVAUX : ${rivals.join(' | ')}
DIFFÉRENTIELS DISPONIBLES : ${diffs.join(' | ') || '—'}`

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: context },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: message },
      ],
      thinking: { type: 'disabled' },
    })
    const reply = completion.choices[0]?.message?.content?.trim()
    if (!reply) throw new Error('Réponse vide du modèle')
    return NextResponse.json({ reply })
  } catch (e) {
    console.error('assistant error', e)
    // Repli : réponse basée sur les règles si le modèle échoue
    try {
      const data = await getCoachData()
      const capt = data.me.captainSuggestion
      const best = data.transfers.buy[0]
      const worst = data.transfers.sell[0]
      const fallback = `⚠️ L'IA conversationnelle est momentanément indisponible — voici l'analyse du moteur :\n\n${capt ? `🧢 Capitaine : mets le brassard sur ${capt.name} (proj ${capt.projection}).\n` : '🧢 Ton capitaine actuel est déjà optimal.\n'}${worst ? `🔴 Vente prioritaire : ${worst.player.name} — ${worst.reason}.\n` : ''}${best ? `🟢 Cible prioritaire : ${best.player.name} (${best.player.teamShort}, ${best.player.price}M, proj ${best.player.projection})${best.comparedTo ? ` à la place de ${best.comparedTo} (+${best.netGain})` : ''}.\n` : ''}💎 Différentiel à surveiller : ${data.differentials[0] ? `${data.differentials[0].name} (${data.differentials[0].teamShort}, proj ${data.differentials[0].projection})` : 'aucun fort cette semaine'}.`
      return NextResponse.json({ reply: fallback, fallback: true })
    } catch {
      return NextResponse.json({ error: "L'assistant est indisponible" }, { status: 500 })
    }
  }
}
