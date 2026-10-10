import { cn } from '@/lib/cn'

/* Símbolo provisório do REDSHIELD: um escudo simples, com um recorte diagonal.
   Substituir pelo logotipo oficial da academia quando houver arquivo (ver pendência V1). */
export function LogoMark({ className, cor = 'currentColor' }: { className?: string; cor?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-8', className)} fill="none" aria-hidden>
      <path d="M20 3 L35 8.5 V19.5 C35 28 28.8 34.4 20 37 C11.2 34.4 5 28 5 19.5 V8.5 Z" fill={cor} />
      <path d="M20 3 L35 8.5 V19.5 C35 21 34.8 22.4 34.4 23.8 L20 11 Z" fill="#ffffff" opacity="0.28" />
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
      <LogoMark className={cn('size-8 shrink-0', tomEscuro ? 'text-white' : 'text-rs-red-600')} />
      {!compacto && (
        <span className="min-w-0 leading-none">
          <span className={cn('rs-title block text-lg', tomEscuro ? 'text-white' : 'text-rs-ink')}>
            REDSHIELD
          </span>
          <span className={cn('block text-[10px] font-semibold uppercase tracking-[0.18em]', tomEscuro ? 'text-white/60' : 'text-rs-gray-500')}>
            Gestão
          </span>
        </span>
      )}
    </span>
  )
}
