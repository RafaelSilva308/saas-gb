import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Contexto } from '../app.js'
import { auditar } from '../auditoria.js'
import { exigir, sessaoDe } from '../auth/sessao.js'
import { comTransacao } from '../db/pool.js'
import { conflito, naoEncontrado } from '../erros.js'
import { uuid, validar } from '../validacao.js'

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v)
const limpar = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, iso(v)]))

/** Direitos do titular (LGPD, art. 18): cópia dos dados e eliminação/anonimização. Só o gestor, sempre auditado. */
export async function rotasLgpd(app: FastifyInstance, ctx: Contexto) {
  const { db } = ctx
  const gestor = exigir('gestor')

  app.get('/alunos/:id/exportacao', { preHandler: gestor }, async (req, reply) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    const aluno = (await db.query('select * from aluno where id = $1 and academia_id = $2', [id, s.academiaId])).rows[0]
    if (!aluno) throw naoEncontrado('Aluno')

    const consulta = async (sql: string) => (await db.query(sql, [id])).rows.map(limpar)
    const dados = {
      geradoEm: ctx.agora().toISOString(),
      aluno: limpar(aluno),
      turmas: await consulta(`select t.nome, at.desde::text, at.ate::text from aluno_turma at join turma t on t.id = at.turma_id where at.aluno_id = $1 order by at.desde`),
      graduacoes: await consulta(`select faixa, graus, data::text, observacao from graduacao where aluno_id = $1 order by data, criado_em`),
      presencas: await consulta(
        `select ch.data::text, p.status, p.origem, p.registrado_em, p.observacao from presenca p join chamada ch on ch.id = p.chamada_id where p.aluno_id = $1 order by ch.data`,
      ),
      cobrancas: await consulta(`select competencia::text, vencimento::text, valor_centavos, status, pago_em::text from cobranca where aluno_id = $1 order by competencia`),
      pagamentos: await consulta(`select data::text, valor_centavos, metodo, descricao from transacao where aluno_id = $1 order by data`),
      emailsEnviados: await consulta(`select tipo, status, criado_em from envio_email where aluno_id = $1 order by criado_em`),
    }
    await auditar(db, s, 'lgpd.exportar', 'aluno', id, null, null, req.ip)
    return reply
      .header('content-disposition', `attachment; filename="dados-do-aluno-${id}.json"`)
      .header('cache-control', 'no-store')
      .send(dados)
  })

  /**
   * Apaga os dados pessoais e mantém o que a lei manda guardar ou o que não identifica ninguém: valores de cobranças e
   * lançamentos (obrigação fiscal/contábil) e a contagem de presenças. Não tem volta.
   */
  app.post('/alunos/:id/anonimizar', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    validar(z.object({ confirmacao: z.literal('ANONIMIZAR', { error: 'Digite ANONIMIZAR para confirmar.' }) }), req.body)

    return comTransacao(db, async (c) => {
      const aluno = (await c.query('select id, anonimizado_em from aluno where id = $1 and academia_id = $2 for update', [id, s.academiaId])).rows[0]
      if (!aluno) throw naoEncontrado('Aluno')
      if (aluno.anonimizado_em) throw conflito('aluno_anonimizado', 'Este cadastro já foi anonimizado.')

      await c.query(
        `update aluno set nome = 'Aluno anonimizado', email = null, telefone = null, nascimento = null,
                responsavel_nome = null, responsavel_telefone = null, observacoes = null, foto_url = null,
                consentimento_por = null, uso_imagem_autorizado = false, status = 'inativo',
                anonimizado_em = now(), atualizado_em = now()
          where id = $1`,
        [id],
      )
      await c.query(`update aluno_turma set ate = coalesce(ate, greatest(desde, current_date)) where aluno_id = $1`, [id])
      await c.query(`update cobranca set status = 'cancelada' where aluno_id = $1 and status = 'aberta'`, [id])
      await c.query(`update graduacao set observacao = null where aluno_id = $1`, [id])
      await c.query(`update presenca set observacao = null where aluno_id = $1`, [id])
      await c.query(`update envio_email set destinatario = 'anonimizado-' || id::text where aluno_id = $1`, [id])
      await c.query(`update transacao set descricao = 'Pagamento (aluno anonimizado)' where aluno_id = $1 and cobranca_id is not null`, [id])
      // O histórico de auditoria guarda cópias dos dados pessoais: mantém quem fez o quê e quando, descarta o conteúdo.
      await c.query(`update log_auditoria set dados_antes = null, dados_depois = null where entidade = 'aluno' and entidade_id = $1`, [id])
      await c.query('delete from sessao where usuario_id in (select id from usuario where aluno_id = $1)', [id])
      await c.query(
        `update usuario set ativo = false, senha_hash = null, nome = 'Aluno anonimizado', email = 'anonimizado-' || id::text || '@anonimizado.invalid'
          where aluno_id = $1`,
        [id],
      )
      await auditar(c, s, 'lgpd.anonimizar', 'aluno', id, null, null, req.ip)
      return { id, anonimizado: true }
    })
  })
}
