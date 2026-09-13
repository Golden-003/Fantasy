'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Qui dois-je mettre capitaine cette journée ?',
  'Qui dois-je mettre titulaire ?',
  'Quel transfert faire en priorité ?',
  'Un différentiel poursurprendre mes rivaux ?',
  'Qui est à risque de rotation dans mon équipe ?',
]

export function AssistantTab({ nextGw }: { nextGw: number }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: `👋 Coach, je suis ton copilote pour la journée ${nextGw}. J'ai accès à ton équipe, aux projections du moteur, au calendrier et aux équipes de tes 4 rivaux. Que veux-tu décider ?` },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const send = async (text: string) => {
    const msg = text.trim()
    if (!msg || loading) return
    setError(null)
    setInput('')
    const nextHistory = [...messages, { role: 'user' as const, content: msg }]
    setMessages([...nextHistory, { role: 'assistant', content: '…' }])
    setLoading(true)
    setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }), 50)
    try {
      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/coach/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Erreur')
      setMessages([...nextHistory, { role: 'assistant', content: json.reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'assistant n'a pas répondu")
      setMessages(nextHistory)
    } finally {
      setLoading(false)
      setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }), 50)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={scrollRef} className="max-h-[58vh] min-h-[320px] space-y-3 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
              m.role === 'user' ? 'rounded-br-sm bg-emerald-600/90 text-white' : 'rounded-bl-sm border border-slate-800 bg-slate-900/90 text-slate-200',
              m.content === '…' && 'animate-pulse',
            )}>
              {m.content === '…' ? '🧠 Analyse en cours…' : m.role === 'user' ? m.content : (
                <div className="space-y-1.5 [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:m-0 [&_strong]:font-bold [&_strong]:text-emerald-300">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={loading} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300 transition hover:border-emerald-500/60 hover:text-emerald-300 disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      {error && <Card className="border-red-500/40 bg-red-500/10"><CardContent className="p-3 text-xs text-red-300">{error} — réessaie dans un instant.</CardContent></Card>}

      <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pose ta question de coach…"
          className="h-11 flex-1 border-slate-800 bg-slate-900/80"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()} className="h-11 bg-emerald-600 px-5 text-white hover:bg-emerald-500">
          {loading ? '…' : 'Envoyer'}
        </Button>
      </form>
    </div>
  )
}
