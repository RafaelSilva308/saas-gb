import { cn } from '@/lib/cn'

/* Marca ABSTRATA e original do produto.
   O guia é explícito: não redesenhar o monograma, escudo, selo ou logotipo oficial
   da rede. Este símbolo usa apenas a geometria diagonal descrita no guia. */
export function LogoMark({ className, cor = 'currentColor' }: { className?: string; cor?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-8', className)} fill="none" aria-hidden>
      <path d="M20 4 L34 34 H26.5 L20 19.5 L13.5 34 H6 Z" fill={cor} />
      <path d="M20 24.5 L23.5 32 H16.5 Z" fill={cor} opacity="0.55" />
    </svg>
  )
}

export function Logo({
  className,
  compacto,
  tomEscuro,
}: {
  className?: string
  compacto?: boolean
  tomEscuro?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={cn('size-8 shrink-0', tomEscuro ? 'text-white' : 'text-gb-red-600')} />
      {!compacto && (
        <span className="min-w-0 leading-none">
          <span className={cn('gb-title block text-lg', tomEscuro ? 'text-white' : 'text-gb-ink')}>
            Tatame
          </span>
          <span className={cn('block text-[10px] font-semibold uppercase tracking-[0.18em]', tomEscuro ? 'text-white/60' : 'text-gb-gray-500')}>
            Gestão
          </span>
        </span>
      )}
    </span>
  )
}
