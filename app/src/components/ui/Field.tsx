import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/cn'

const controle =
  'w-full rounded-md border border-gb-gray-300 bg-white px-3 text-sm text-gb-ink placeholder:text-gb-gray-500/70 ' +
  'transition-colors hover:border-gb-gray-500 focus:border-gb-blue-600 focus:outline-none ' +
  'focus:ring-2 focus:ring-gb-blue-600/20 disabled:bg-gb-gray-100 disabled:text-gb-gray-500'

function Envolucro({
  label,
  hint,
  erro,
  htmlFor,
  children,
  className,
}: {
  label?: string
  hint?: string
  erro?: string
  htmlFor: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-semibold text-gb-gray-700">
          {label}
        </label>
      )}
      {children}
      {erro ? (
        <p className="text-xs font-medium text-gb-red-600">{erro}</p>
      ) : hint ? (
        <p className="text-xs text-gb-gray-500">{hint}</p>
      ) : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  erro?: string
  wrapClass?: string
  iconeEsq?: ReactNode
}

export function Input({ label, hint, erro, wrapClass, iconeEsq, className, ...rest }: InputProps) {
  const id = useId()
  return (
    <Envolucro label={label} hint={hint} erro={erro} htmlFor={id} className={wrapClass}>
      <div className="relative">
        {iconeEsq && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gb-gray-500">
            {iconeEsq}
          </span>
        )}
        <input
          id={id}
          className={cn(controle, 'h-10', iconeEsq && 'pl-9', erro && 'border-gb-red-600', className)}
          aria-invalid={!!erro}
          {...rest}
        />
      </div>
    </Envolucro>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  erro?: string
  wrapClass?: string
  children: ReactNode
}

export function Select({ label, hint, erro, wrapClass, className, children, ...rest }: SelectProps) {
  const id = useId()
  return (
    <Envolucro label={label} hint={hint} erro={erro} htmlFor={id} className={wrapClass}>
      <select id={id} className={cn(controle, 'h-10 cursor-pointer pr-8', className)} {...rest}>
        {children}
      </select>
    </Envolucro>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  erro?: string
  wrapClass?: string
}

export function Textarea({ label, hint, erro, wrapClass, className, ...rest }: TextareaProps) {
  const id = useId()
  return (
    <Envolucro label={label} hint={hint} erro={erro} htmlFor={id} className={wrapClass}>
      <textarea id={id} rows={4} className={cn(controle, 'py-2.5 leading-relaxed', className)} {...rest} />
    </Envolucro>
  )
}

/** Alternador binário acessível, usado em configurações. */
export function Switch({
  checked,
  onChange,
  label,
  descricao,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  descricao?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gb-ink">{label}</span>
        {descricao && <span className="mt-0.5 block text-xs text-gb-gray-500">{descricao}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
          checked ? 'bg-gb-blue-600' : 'bg-gb-gray-300',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </label>
  )
}
