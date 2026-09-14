import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { getAssistantContext } from '@/lib/coach/engine'

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

    // Contexte 100% données réelles (captures + articles officiels Sofascore)
    const context = await getAssistantContext()

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
    // Repli rule-based : toujours ancré sur les vraies données du moteur
    try {
      const { getOverview, getCaptainPicks, getTransferFlags, getMarketTargets } = await import('@/lib/coach/engine')
      const [ov, caps, flags, targets] = await Promise.all([getOverview(), getCaptainPicks(), getTransferFlags(), getMarketTargets()])
      const cap = caps[0]
      const flag = flags.find((f) => f.kind === 'SURVEILLER') ?? flags[0]
      const target = targets[0]
      const fallback = `⚠️ L'IA conversationnelle est momentanément indisponible — voici l'analyse du moteur (données réelles) :\n\n🧢 Capitaine R5 : ${cap ? `${cap.name} — ${cap.fixture} (${cap.reasons[0]})` : 'à confirmer'}\n${flag ? `👀 ${flag.kind} : ${flag.name} — ${flag.reason}\n` : ''}${target ? `🟢 Cible sourcée : ${target.name} (${target.club}, ${target.price} M€) — ${target.rationale}\n` : ''}📊 Tu es ${ov.myRank}ᵉ avec ${ov.myTotal} pts (écart leader : ${ov.gapToLeader}). Prochaine étape : R5 le ${ov.nextRoundDate}, 2 transferts gratuits.`
      return NextResponse.json({ reply: fallback, fallback: true })
    } catch {
      return NextResponse.json({ error: "L'assistant est indisponible" }, { status: 500 })
    }
  }
}
