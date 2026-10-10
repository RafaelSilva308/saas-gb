import type { FastifyRequest } from 'fastify'
import type { Executor } from '../db/pool.js'
import { naoAutenticado, semPermissao } from '../erros.js'
import { hashToken } from './senha.js'

export type Papel = 'gestor' | 'professor' | 'aluno'

export interface Sessao {
  usuarioId: string
  /** Sempre vem do banco, via sessão. Nenhuma rota aceita academia_id do cliente. */
  academiaId: string
  papel: Papel
  nome: string
  email: string
  alunoId: string | null
}

export const COOKIE = 'rs.sid'

export async function lerSessao(db: Executor, token: string | undefined): Promise<Sessao | null> {
  if (!token) return null
  const { rows } = await db.query(
    `select u.id, u.academia_id, u.papel, u.nome, u.email, u.aluno_id
       from sessao s join usuario u on u.id = s.usuario_id
      where s.token_hash = $1 and s.expira_em > now() and u.ativo`,
    [hashToken(token)],
  )
  const r = rows[0]
  if (!r) return null
  return { usuarioId: r.id, academiaId: r.academia_id, papel: r.papel, nome: r.nome, email: r.email, alunoId: r.aluno_id }
}

declare module 'fastify' {
  interface FastifyRequest {
    sessao: Sessao | null
  }
}

/** Use como `preHandler`. Sem papéis = qualquer usuário autenticado. */
export function exigir(...papeis: Papel[]) {
  return async (req: FastifyRequest) => {
    if (!req.sessao) throw naoAutenticado()
    if (papeis.length && !papeis.includes(req.sessao.papel)) throw semPermissao()
  }
}

export function sessaoDe(req: FastifyRequest): Sessao {
  if (!req.sessao) throw naoAutenticado()
  return req.sessao
}
