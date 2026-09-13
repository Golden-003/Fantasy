'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { OverviewPayload } from '@/lib/coach/types'
import { VerdictBadge, fmt } from './ui-helpers'

export function TransfersTab({ data, onSelect }: { data: OverviewPayload; onSelect: (id: string) => void }) {
  const { transfers } = data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Card className="border-slate-800 bg-slate-900/60"><CardContent className="flex items-center gap-4 p-4"><div><div className="text-xs text-slate-400">Banque</div><div className="text-xl font-bold text-emerald-400">{fmt(transfers.bank)}M</div></div></CardContent></Card>
        <Card className="border-slate-800 bg-slate-900/60"><CardContent className="p-4"><div className="text-xs text-slate-400">Transferts restants</div><div className="text-xl font-bold text-slate-100">{transfers.transfersLeft}</div></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-300">🔻 À vendre en priorité</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {transfers.sell.map((s) => (
              <button key={s.player.id} onClick={() => onSelect(s.player.id)} className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-left transition hover:border-red-500/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{s.player.name}</span>
                    <Badge variant="outline" className="border-slate-700 text-[10px] text-slate-400">{s.player.teamShort} • {fmt(s.player.price)}M</Badge>
                  </div>
                  <VerdictBadge verdict={s.player.verdict} compact />
                </div>
                <div className="mt-1 text-xs text-slate-400">{s.reason}</div>
              </button>
            ))}
            {transfers.sell.length === 0 && <div className="text-sm text-slate-500">Aucune vente urgente détectée. ✅</div>}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-300">🎯 Cibles recommandées</CardTitle></CardHeader>
          <CardContent className="max-h-[62vh] space-y-2 overflow-y-auto">
            {transfers.buy.map((b) => (
              <button key={b.player.id} onClick={() => onSelect(b.player.id)} className={`w-full rounded-lg border p-3 text-left transition ${b.affordable ? 'border-slate-800 bg-slate-950/60 hover:border-emerald-500/50' : 'border-slate-800/60 bg-slate-950/30 opacity-70 hover:border-amber-500/40'}`}>
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{b.player.name}</span>
                    <Badge variant="outline" className="border-slate-700 text-[10px] text-slate-400">{b.player.teamShort}</Badge>
                    <Badge variant="outline" className="border-slate-700 text-[10px] text-slate-300">{fmt(b.player.price)}M</Badge>
                    {b.differential && <Badge className="border-purple-400/40 bg-purple-500/15 text-[10px] text-purple-300">💎 Différentiel</Badge>}
                    {!b.affordable && <Badge className="border-amber-400/40 bg-amber-500/15 text-[10px] text-amber-300">Sell-up requis</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-200">{fmt(b.player.projection)}</span>
                    {b.netGain !== null && b.netGain > 0 && <span className="text-xs font-bold text-emerald-400">+{fmt(b.netGain)}</span>}
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-400">{b.justification}</div>
                {b.comparedTo && <div className="mt-0.5 text-[11px] text-slate-500">↔ Remplacerait : {b.comparedTo}{b.netGain !== null ? ` (${b.netGain >= 0 ? '+' : ''}${fmt(b.netGain)} de projection)` : ''}</div>}
              </button>
            ))}
            {transfers.buy.length === 0 && <div className="text-sm text-slate-500">Aucune cible supérieure trouvée avec ce budget.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
