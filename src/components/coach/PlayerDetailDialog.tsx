'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DiffBadge, PlayerAvatar, PosBadge, Price, Own, StatusBadge, fr } from '@/components/coach/ui-helpers'
import type { PlayerDetail } from '@/lib/coach/types'
import { Loader2 } from 'lucide-react'

export default function PlayerDetailDialog({ playerId, onClose }: { playerId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<PlayerDetail | null>(null)
  // chargement dérivé : on charge tant que le détail affiché ne correspond pas au joueur demandé
  const loading = playerId != null && detail?.id !== playerId

  useEffect(() => {
    if (!playerId) return
    let cancelled = false
    fetch(`/api/coach/players?id=${playerId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setDetail(d.error ? null : d) })
      .catch(() => { if (!cancelled) setDetail(null) })
    return () => { cancelled = true }
  }, [playerId])

  return (
    <Dialog open={playerId != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        {loading || !detail ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-left text-base">
                <PlayerAvatar name={detail.name} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    {detail.name} <PosBadge pos={detail.position} />
                  </span>
                  <span className="text-xs font-normal text-slate-500">{detail.club}</span>
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={detail.status} />
                <Price value={detail.price} priceRef={detail.priceRef} />
                <Own value={detail.ownership} valueRef={detail.ownershipRef} />
                {detail.news && <span className="text-xs text-amber-700">{detail.news}</span>}
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Forme', value: fr(detail.form) },
                  { label: 'Points', value: detail.totalPoints ?? '—' },
                  { label: 'Minutes', value: detail.minutes ?? '—' },
                  { label: 'Proj. J+1', value: fr(detail.epNext) },
                  { label: 'Buts', value: detail.goals ?? '—' },
                  { label: 'Passes D.', value: detail.assists ?? '—' },
                  { label: 'xG', value: fr(detail.xg, 2) },
                  { label: 'xA', value: fr(detail.xa, 2) },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-sm font-bold tabular-nums text-slate-900">{s.value}</p>
                    <p className="text-[10px] text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {detail.fixturesDetailed?.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Prochains matchs</p>
                  <div className="space-y-1.5">
                    {detail.fixturesDetailed.map((f) => (
                      <div key={f.round} className="flex items-center gap-2 text-sm">
                        <span className="w-8 shrink-0 text-xs font-semibold text-slate-400">J{f.round}</span>
                        <span className="flex-1">{f.isHome ? 'vs' : '@'} {f.opponent}</span>
                        {f.kickoff && (
                          <span className="text-xs text-slate-400">
                            {new Date(f.kickoff).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        <DiffBadge difficulty={f.difficulty} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
