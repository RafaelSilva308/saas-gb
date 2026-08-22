import { cn } from '@/lib/cn'
import { iniciais } from '@/lib/format'

const TAM = {
  sm: 'size-8 text-[11px]',
  md: 'size-10 text-xs',
  lg: 'size-14 text-base',
  xl: 'size-20 text-2xl',
}

/** Avatar por iniciais — o guia pede fotografia real; aqui usamos o fallback tipográfico. */
export function Avatar({
  nome,
  tamanho = 'md',
  className,
}: {
  nome: string
  tamanho?: keyof typeof TAM
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-gb-gray-200 bg-gb-gray-100 font-bold tracking-wide text-gb-gray-700',
        TAM[tamanho],
        className,
      )}
    >
      {iniciais(nome)}
    </span>
  )
}
