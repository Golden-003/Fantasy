'use client'

import type { AlertItem } from '@/lib/coach/types'
import { cn } from '@/lib/utils'

const SEV_CLS: Record<AlertItem['severity'], string> = {
  danger: 'border-red-500/40 bg-red-500/10',
  warning: 'border-amber-500/40 bg-amber-500/10',
  success: 'border-emerald-500/40 bg-emerald-500/10',
  info: 'border-slate-700 bg-slate-900/70',
}
const SEV_LABEL: Record<AlertItem['severity'], string> = {
  danger: 'URGENT',
  warning: 'ATTENTION',
  success: 'OPPORTUNITÉ',
  info: 'INFO',
}
const SEV_TEXT: Record<AlertItem['severity'], string> = {
  danger: 'text-red-300',
  warning: 'text-amber-300',
  success: 'text-emerald-300',
  info: 'text-slate-300',
}

export function AlertsTab({ alerts, onSelect }: { alerts: AlertItem[]; onSelect: (id?: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Surveillance automatique de ta ligue : risques sur ton effectif, opportunités différentielles, joueurs en forme, menaces des rivaux.</p>
      <div className="max-h-[64vh] space-y-2 overflow-y-auto pr-1">
        {alerts.map((a) => (
          <button
            key={a.id}
            onClick={() => a.playerId && onSelect(a.playerId)}
            disabled={!a.playerId}
            className={cn('flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition sm:flex-row sm:items-center sm:gap-3', SEV_CLS[a.severity], a.playerId && 'hover:brightness-125')}
          >
            <span className={cn('w-fit shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider', SEV_TEXT[a.severity], 'bg-black/30')}>{SEV_LABEL[a.severity]}</span>
            <div className="min-w-0">
              <div className={cn('text-sm font-semibold', SEV_TEXT[a.severity])}>{a.title}</div>
              <div className="text-xs text-slate-400">{a.detail}</div>
            </div>
          </button>
        ))}
        {alerts.length === 0 && <div className="text-sm text-slate-500">Aucune alerte active — profite. 😌</div>}
      </div>
    </div>
  )
}
