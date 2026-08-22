import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Variante = 'primaria' | 'secundaria' | 'contorno' | 'fantasma' | 'perigo'
type Tamanho = 'sm' | 'md' | 'lg'

/* Guia visual:
   - primária  = vermelho sólido, texto branco (usar com parcimônia, 1 por tela)
   - secundária = branco com contorno azul
   - contorno  = branco com borda neutra
   - fantasma  = sem fundo, para ações terciárias */
const VARIANTES: Record<Variante, string> = {
  primaria:
    'bg-gb-red-600 text-white hover:bg-gb-red-700 active:bg-gb-red-700 shadow-[0_1px_2px_rgba(212,0,0,0.25)]',
  secundaria: 'bg-white text-gb-blue-600 border border-gb-blue-600 hover:bg-gb-blue-50',
  contorno: 'bg-white text-gb-ink border border-gb-gray-300 hover:bg-gb-gray-50 hover:border-gb-gray-500',
  fantasma: 'bg-transparent text-gb-gray-700 hover:bg-gb-gray-100 hover:text-gb-ink',
  perigo: 'bg-white text-gb-red-600 border border-gb-red-600 hover:bg-gb-red-50',
}

const TAMANHOS: Record<Tamanho, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
}

const base =
  'inline-flex items-center justify-center rounded-md font-semibold tracking-wide transition-colors duration-150 ' +
  'disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap cursor-pointer'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamanho?: Tamanho
  children: ReactNode
}

export function Button({ variante = 'contorno', tamanho = 'md', className, children, ...rest }: Props) {
  return (
    <button className={cn(base, VARIANTES[variante], TAMANHOS[tamanho], className)} {...rest}>
      {children}
    </button>
  )
}

export function ButtonLink({
  to,
  variante = 'contorno',
  tamanho = 'md',
  className,
  children,
}: {
  to: string
  variante?: Variante
  tamanho?: Tamanho
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={cn(base, VARIANTES[variante], TAMANHOS[tamanho], className)}>
      {children}
    </Link>
  )
}
