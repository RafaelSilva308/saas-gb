import type { Executor } from './db/pool.js'
import type { Sessao } from './auth/sessao.js'

export async function auditar(
  db: Executor,
  s: Pick<Sessao, 'academiaId' | 'usuarioId'>,
  acao: string,
  entidade: string,
  entidadeId: string | null,
  antes: unknown,
  depois: unknown,
  ip?: string,
) {
  await db.query(
    `insert into log_auditoria (academia_id, usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois, ip)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [s.academiaId, s.usuarioId, acao, entidade, entidadeId, antes ?? null, depois ?? null, ip ?? null],
  )
}
