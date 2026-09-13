'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function SetupDialog({ open, onOpenChange, onSaved }: Props) {
  const [teamId, setTeamId] = useState('')
  const [leagueId, setLeagueId] = useState('')
  const [cookie, setCookie] = useState('')
  const [showCookie, setShowCookie] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, leagueId, cookie: cookie.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Erreur de validation')
      setMsg({ ok: true, text: `✅ Connecté : ${json.teamName} — ligue « ${json.leagueName} ». Chargement des données réelles…` })
      setTimeout(() => {
        onOpenChange(false)
        onSaved()
      }, 900)
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Erreur' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">🔌 Connecter mes vraies données</DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            Le logiciel se branche en direct sur l&apos;API officielle Fantasy Premier League. <strong className="text-slate-200">Aucun mot de passe requis</strong> — seuls les IDs publics de ton équipe et de ta ligue sont nécessaires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="teamId" className="text-slate-200">Team ID (ton équipe réelle)</Label>
            <Input id="teamId" inputMode="numeric" placeholder="ex : 1234567" value={teamId} onChange={(e) => setTeamId(e.target.value.replace(/\D/g, ''))} className="h-10 border-slate-800 bg-slate-900/80" />
            <p className="text-[11px] leading-relaxed text-slate-500">
              Sur <span className="text-slate-400">fantasy.premierleague.com</span> : ouvre ton équipe → onglet « Points par journée » → l&apos;URL affiche <code className="rounded bg-slate-900 px-1 text-emerald-300">/entry/<b>1234567</b>/event/…</code>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="leagueId" className="text-slate-200">League ID (ta ligue privée)</Label>
            <Input id="leagueId" inputMode="numeric" placeholder="ex : 987654" value={leagueId} onChange={(e) => setLeagueId(e.target.value.replace(/\D/g, ''))} className="h-10 border-slate-800 bg-slate-900/80" />
            <p className="text-[11px] leading-relaxed text-slate-500">
              Sur la page « Classement » de ta ligue : l&apos;URL affiche <code className="rounded bg-slate-900 px-1 text-emerald-300">/leagues-classic/<b>987654</b>/standings</code>
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40">
            <button onClick={() => setShowCookie(!showCookie)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-slate-300 hover:text-emerald-300">
              <span>⚙️ Avancé — cookie de session (optionnel, temps réel total)</span>
              <span>{showCookie ? '▾' : '▸'}</span>
            </button>
            {showCookie && (
              <div className="space-y-1.5 px-3 pb-3">
                <Input id="cookie" type="password" placeholder="cookie: plprofile=…; pl_settings=…" value={cookie} onChange={(e) => setCookie(e.target.value)} className="h-10 border-slate-800 bg-slate-900/80 font-mono text-xs" />
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Optionnel : donne les transferts restants et chips <b>exact</b> (endpoint privé /my-team). Sur le site FPL connecté : F12 → onglet Réseau → clique une requête API → en-tête « Cookie » → copie toute la valeur. Stockée localement dans ta base, jamais partagée. Sans cookie : le logiciel estime tes transferts depuis ton historique réel.
                </p>
              </div>
            )}
          </div>

          {msg && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${msg.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
              {msg.text}
            </div>
          )}

          <Button onClick={save} disabled={saving || !teamId || !leagueId} className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-500">
            {saving ? 'Validation en direct sur l’API FPL…' : 'Connecter mon équipe réelle'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
