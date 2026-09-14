'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, SendHorizonal } from 'lucide-react'

interface Msg { role: 'user' | 'assistant'; content: string }

const QUICK = [
  'Qui mettre capitaine pour la J5 ?',
  'Qui dois-je transférer avant la clôture ?',
  'Analyse nik Leroy : comment rattraper les points ?',
  'Comment marchent les tokens ?',
]

export default function AssistantTab() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Salut coach. Je suis branché sur ton effectif, le classement de la ligue et la base complète de Premier League. Demande-moi capitaine, transferts, rivaux ou règles.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  async function send(text: string) {
    const message = text.trim()
    if (!message || loading) return
    const history = msgs.filter((m) => m !== msgs[0]).slice(-6)
    setMsgs((m) => [...m, { role: 'user', content: message }])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/coach/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      })
      const d = await res.json()
      setMsgs((m) => [...m, { role: 'assistant', content: d.reply ?? (d.error ?? 'Erreur inconnue') }])
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Connexion perdue avec l’assistant. Réessaie.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="flex h-[calc(100vh-13rem)] min-h-[420px] flex-col">
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'rounded-br-sm bg-slate-900 text-white'
                    : 'rounded-bl-sm border border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3">
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-100 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pose ta question de coach…"
              disabled={loading}
              className="flex-1 border-slate-200 bg-white"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-700 disabled:opacity-40"
              aria-label="Envoyer"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
            <MessageSquare className="h-3 w-3" /> Réponses ancrées sur les données enregistrées — jamais inventées.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
