import { z } from 'zod'
import { ErroApi } from './erros.js'

z.config(z.locales.pt())

export function validar<S extends z.ZodType>(schema: S, dados: unknown): z.output<S> {
  const r = schema.safeParse(dados)
  if (r.success) return r.data
  const campos: Record<string, string> = {}
  for (const i of r.error.issues) campos[i.path.join('.') || '_'] ??= i.message
  throw new ErroApi(400, 'validacao', 'Confira os campos informados.', campos)
}

export const uuid = z.string().uuid('Identificador inválido.')
export const dataISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Data inválida.')
