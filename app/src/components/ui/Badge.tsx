import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { FAIXAS } from '@/lib/format'
import type { Faixa } from '@/types'

type Tom = 'neutro' | 'azul' | 'ok' | 'alerta' | 'urgente'

/* Cada tom carrega cor + texto. Nunca depender só da cor: o rótulo sempre aparece. */
const TONS: Record<Tom, string> = {
  neutro: 'bg-rs-gray-100 text-rs-gray-700 border-rs-gray-200',
  azul: 'bg-rs-blue-50 text-rs-blue-700 border-rs-blue-100',
  ok: 'bg-rs-success-bg text-rs-success border-transparent',
  alerta: 'bg-rs-warn-bg text-rs-warn border-transparent',
  urgente: 'bg-rs-red-50 text-rs-red-700 border-rs-red-100',
}

export function Badge({ tom = 'neutro', children, className }: { tom?: Tom; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONS[tom],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Faixa com bolinha da cor + rótulo textual e graus. */
export function FaixaBadge({ faixa, graus, compacto }: { faixa: Faixa; graus?: number; compacto?: boolean }) {
  const f = FAIXAS[faixa]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden
        className="size-3 shrink-0 rounded-full border border-black/15"
        style={{ background: f.cor }}
      />
      <span className={cn('font-medium', compacto ? 'text-xs' : 'text-sm')}>
        {compacto ? f.label : `Faixa ${f.label}`}
      </span>
      {graus !== undefined && graus > 0 && (
        <span className="text-xs text-rs-gray-500">
          {graus}º grau{graus > 1 ? 's' : ''}
        </span>
      )}
    </span>
  )
}
