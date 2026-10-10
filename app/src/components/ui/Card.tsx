import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Card: branco sobre cinza muito claro, borda sutil, sombra mínima. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        'rounded-lg border border-rs-gray-200 bg-white shadow-[var(--shadow-card)] overflow-hidden',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  titulo,
  descricao,
  acao,
  linkTexto,
  linkPara,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
  linkTexto?: string
  linkPara?: string
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-rs-gray-200 px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <h2 className="rs-title text-lg text-rs-ink">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-sm text-rs-gray-500">{descricao}</p>}
      </div>
      {acao}
      {linkPara && (
        <Link
          to={linkPara}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-rs-blue-600 hover:text-rs-blue-700 hover:underline"
        >
          {linkTexto ?? 'Ver tudo'}
          <ChevronRight className="size-3.5" />
        </Link>
      )}
    </header>
  )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-4 sm:p-5', className)}>{children}</div>
}
