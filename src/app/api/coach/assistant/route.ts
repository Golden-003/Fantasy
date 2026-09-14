import { NextResponse } from 'next/server'
import { getAssistantContext } from '@/lib/coach/analysis'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface ChatMessage { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const message: string | undefined = body?.message
    const history: ChatMessage[] = Array.isArray(body?.history) ? body.history.slice(-6) : []
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message manquant' }, { status: 400 })
    }

    // Contexte 100% construit depuis les données en base (moteur d'analyse)
    const context = await getAssistantContext()

    // Import dynamique : si le SDK n'est pas disponible/paramétrable
    // (ex. déploiement Vercel sans identifiants), on bascule sur le repli.
    const { default: ZAI } = await import('z-ai-web-dev-sdk')
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
    // Repli rule-based : briefing chiffré par le moteur d'analyse, jamais inventé
    try {
      const { getAnalysis } = await import('@/lib/coach/analysis')
      const a = await getAnalysis()
      const fr = (n: number | null | undefined, d = 1) => (n == null ? '—' : n.toFixed(d).replace('.', ','))
      const lines: string[] = [
        `L'IA conversationnelle est momentanément indisponible — voici le briefing du moteur d'analyse :`,
        '',
        `Situation : ${a.league.myRank}${a.league.myRank === 1 ? 'er' : 'e'} avec ${a.league.myTotal ?? '?'} pts (écart leader : ${a.league.gapToLeader}, ${a.league.leaderName}).`,
      ]
      if (a.prediction) {
        lines.push(
          `Sélection prédite J${a.round} (${a.prediction.formation}) : projection ${fr(a.prediction.projectedLow)} à ${fr(a.prediction.projectedHigh)} pts.`,
          `Capitaine recommandé : ${a.prediction.captain ? `${a.prediction.captain.name} (${a.prediction.captain.club}, proj. ${fr(a.prediction.captain.projected)} pt, ${a.prediction.captain.fixture})` : '—'}.`,
        )
      }
      const cap2 = a.captainMatrix[1]
      if (cap2) lines.push(`Alternative capitaine : ${cap2.name} (${cap2.club}) — ${cap2.reasons[0] ?? ''}.`)
      if (a.transfers[0]) {
        const t = a.transfers[0]
        lines.push(`Transfert prioritaire : ${t.out.name} → ${t.in.name} (${t.in.club}), gain estimé ${fr(t.gain)} pt. Raison sortie : ${t.out.reasons[0]}.`)
      }
      const top = a.comparisons[0]
      if (top) lines.push(`Rival le plus dangereux : ${top.name} — ${top.verdict}.`)
      lines.push(`Dernière synchro des données : ${a.sync.lastAt ? new Date(a.sync.lastAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'jamais'}. Utilise le bouton Actualiser pour rafraîchir.`)
      return NextResponse.json({ reply: lines.join('\n'), fallback: true })
    } catch {
      return NextResponse.json({ error: "L'assistant est indisponible" }, { status: 500 })
    }
  }
}
