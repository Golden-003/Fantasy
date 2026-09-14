import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface ChatMessage { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  let message = ''
  let history: ChatMessage[] = []
  try {
    const body = await req.json().catch(() => null)
    message = typeof body?.message === 'string' ? body.message : ''
    history = Array.isArray(body?.history) ? body.history.slice(-6) : []
    if (!message) {
      return NextResponse.json({ error: 'Message manquant' }, { status: 400 })
    }

    // Contexte 100% construit depuis les données en base (moteur d'analyse)
    const { getAssistantContext } = await import('@/lib/coach/analysis')
    const context = await getAssistantContext()

    // Import dynamique : si le SDK n'est pas disponible/paramétrable
    // (ex. déploiement Vercel sans identifiants), on bascule sur l'analyste.
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
    return NextResponse.json({ reply, engine: 'ai' })
  } catch (e) {
    console.error('assistant ai error', e)
    // Repli : moteur analyste rule-based — répond avec les VRAIES données
    try {
      const { analystAnswer } = await import('@/lib/coach/analyst')
      const r = await analystAnswer(message)
      return NextResponse.json({ reply: r.reply, fallback: true, engine: 'analyst', intent: r.intent })
    } catch (e2) {
      console.error('assistant analyst error', e2)
      return NextResponse.json({ error: "L'assistant est indisponible" }, { status: 500 })
    }
  }
}
