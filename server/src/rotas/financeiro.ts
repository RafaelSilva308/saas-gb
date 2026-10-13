import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Contexto } from '../app.js'
import { auditar } from '../auditoria.js'
import { exigir, sessaoDe } from '../auth/sessao.js'
import { comTransacao, type Executor } from '../db/pool.js'
import { categoriaMensalidades, gerarCobrancas, hojeDaAcademia, primeiroDoMes, somaMeses } from '../financeiro.js'
import { conflito, invalido, naoEncontrado } from '../erros.js'
import { dataISO, uuid, validar } from '../validacao.js'

type Linha = Record<string, any>

const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o formato AAAA-MM.')
const METODOS = ['pix', 'dinheiro', 'cartao', 'boleto', 'transferencia'] as const

export const cobrancaDto = (c: Linha, hoje: string) => {
  const atrasada = c.status === 'aberta' && c.vencimento < hoje
  return {
    id: c.id as string,
    alunoId: c.aluno_id as string,
    alunoNome: (c.aluno_nome ?? null) as string | null,
    planoId: (c.plano_id ?? null) as string | null,
    competencia: String(c.competencia).slice(0, 7),
    vencimento: c.vencimento as string,
    valorCentavos: c.valor_centavos as number,
    status: c.status as 'aberta' | 'paga' | 'cancelada',
    situacao: (atrasada ? 'atrasada' : c.status) as 'aberta' | 'atrasada' | 'paga' | 'cancelada',
    pagoEm: (c.pago_em ?? null) as string | null,
    diasAtraso: atrasada ? Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${c.vencimento}T00:00:00Z`)) / 86_400_000) : 0,
  }
}

export const transacaoDto = (t: Linha) => ({
  id: t.id as string,
  tipo: t.tipo as 'receita' | 'despesa',
  categoriaId: t.categoria_id as string,
  categoria: (t.categoria_nome ?? null) as string | null,
  descricao: t.descricao as string,
  valorCentavos: t.valor_centavos as number,
  data: t.data as string,
  metodo: t.metodo as (typeof METODOS)[number],
  alunoId: (t.aluno_id ?? null) as string | null,
  cobrancaId: (t.cobranca_id ?? null) as string | null,
  conciliada: t.conciliada as boolean,
})

const SELECT_COBRANCA = `select c.*, a.nome as aluno_nome from cobranca c join aluno a on a.id = c.aluno_id`
const SELECT_TRANSACAO = `select t.*, cf.nome as categoria_nome from transacao t join categoria_financeira cf on cf.id = t.categoria_id`

const filtrosCobranca = z.object({
  competencia: mes.optional(),
  status: z.enum(['aberta', 'atrasada', 'paga', 'cancelada']).optional(),
  alunoId: uuid.optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(200).default(50),
})

const corpoTransacao = z.object({
  tipo: z.enum(['receita', 'despesa']),
  categoriaId: uuid,
  descricao: z.string().trim().min(2, 'Informe a descrição.').max(200),
  valorCentavos: z.number().int('Use centavos inteiros.').min(1, 'O valor deve ser maior que zero.').max(1_000_000_00),
  data: dataISO,
  metodo: z.enum(METODOS).optional(),
  alunoId: uuid.nullable().optional(),
  conciliada: z.boolean().optional(),
})

export async function rotasFinanceiro(app: FastifyInstance, ctx: Contexto) {
  const { db } = ctx
  const gestor = exigir('gestor')
  const hoje = (academiaId: string) => hojeDaAcademia(db, ctx.agora(), academiaId)

  async function conferirCategoria(ex: Executor, academiaId: string, categoriaId: string, tipo: 'receita' | 'despesa') {
    const c = (await ex.query('select tipo, ativa from categoria_financeira where id = $1 and academia_id = $2', [categoriaId, academiaId])).rows[0]
    if (!c) throw invalido('Categoria inexistente.', { categoriaId: 'Categoria inexistente.' })
    if (c.tipo !== tipo) throw invalido('A categoria não é do mesmo tipo do lançamento.', { categoriaId: 'Categoria de outro tipo.' })
  }

  async function conferirAluno(ex: Executor, academiaId: string, alunoId?: string | null) {
    if (!alunoId) return
    const r = await ex.query('select 1 from aluno where id = $1 and academia_id = $2', [alunoId, academiaId])
    if (!r.rowCount) throw invalido('Aluno inexistente.', { alunoId: 'Aluno inexistente.' })
  }

  // ------------------------------------------------------------- categorias ----

  app.get('/categorias-financeiras', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { rows } = await db.query('select * from categoria_financeira where academia_id = $1 order by tipo, nome', [s.academiaId])
    return { itens: rows.map((c) => ({ id: c.id as string, tipo: c.tipo as string, nome: c.nome as string, ativa: c.ativa as boolean })) }
  })

  app.post('/categorias-financeiras', { preHandler: gestor }, async (req, reply) => {
    const s = sessaoDe(req)
    const d = validar(z.object({ tipo: z.enum(['receita', 'despesa']), nome: z.string().trim().min(2).max(80) }), req.body)
    try {
      const { rows } = await db.query(`insert into categoria_financeira (academia_id, tipo, nome) values ($1,$2,$3) returning *`, [s.academiaId, d.tipo, d.nome])
      await auditar(db, s, 'categoria.criar', 'categoria_financeira', rows[0].id, null, rows[0], req.ip)
      return reply.status(201).send({ id: rows[0].id, tipo: rows[0].tipo, nome: rows[0].nome, ativa: rows[0].ativa })
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw conflito('categoria_duplicada', 'Já existe uma categoria com esse nome.')
      throw e
    }
  })

  app.patch('/categorias-financeiras/:id', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    const d = validar(z.object({ nome: z.string().trim().min(2).max(80).optional(), ativa: z.boolean().optional() }), req.body)
    const antes = (await db.query('select * from categoria_financeira where id = $1 and academia_id = $2', [id, s.academiaId])).rows[0]
    if (!antes) throw naoEncontrado('Categoria')
    try {
      const { rows } = await db.query(`update categoria_financeira set nome = $3, ativa = $4 where id = $1 and academia_id = $2 returning *`, [
        id, s.academiaId, d.nome ?? antes.nome, d.ativa ?? antes.ativa,
      ])
      await auditar(db, s, 'categoria.atualizar', 'categoria_financeira', id, antes, rows[0], req.ip)
      return { id, tipo: rows[0].tipo as string, nome: rows[0].nome as string, ativa: rows[0].ativa as boolean }
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw conflito('categoria_duplicada', 'Já existe uma categoria com esse nome.')
      throw e
    }
  })

  // -------------------------------------------------------------- cobranças ----

  app.get('/cobrancas', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const f = validar(filtrosCobranca, req.query)
    const dia = await hoje(s.academiaId)
    const params: unknown[] = [s.academiaId]
    const where = ['c.academia_id = $1']
    const add = (sql: string, v: unknown) => {
      params.push(v)
      where.push(sql.replaceAll('?', `$${params.length}`))
    }
    if (f.competencia) add('c.competencia = ?', `${f.competencia}-01`)
    if (f.alunoId) add('c.aluno_id = ?', f.alunoId)
    if (f.status === 'atrasada') add(`c.status = 'aberta' and c.vencimento < ?::date`, dia)
    else if (f.status === 'aberta') add(`c.status = 'aberta' and c.vencimento >= ?::date`, dia)
    else if (f.status) add('c.status = ?', f.status)
    const sql = where.join(' and ')

    const resumoParams = [...params, dia]
    const resumo = (
      await db.query(
        `select coalesce(sum(valor_centavos) filter (where status = 'paga'), 0)::int as pago,
                coalesce(sum(valor_centavos) filter (where status = 'aberta' and vencimento >= $${resumoParams.length}::date), 0)::int as a_vencer,
                coalesce(sum(valor_centavos) filter (where status = 'aberta' and vencimento < $${resumoParams.length}::date), 0)::int as atrasado,
                count(*)::int as total
           from cobranca c where ${sql}`,
        resumoParams,
      )
    ).rows[0]

    const { rows } = await db.query(`${SELECT_COBRANCA} where ${sql} order by c.vencimento desc, a.nome limit $${params.length + 1} offset $${params.length + 2}`, [
      ...params, f.limite, (f.pagina - 1) * f.limite,
    ])
    return {
      itens: rows.map((c) => cobrancaDto(c, dia)),
      total: resumo.total as number,
      pagina: f.pagina,
      limite: f.limite,
      resumo: { pagoCentavos: resumo.pago as number, aVencerCentavos: resumo.a_vencer as number, atrasadoCentavos: resumo.atrasado as number },
    }
  })

  app.get('/alunos/:id/cobrancas', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    if (!(await db.query('select 1 from aluno where id = $1 and academia_id = $2', [id, s.academiaId])).rowCount) throw naoEncontrado('Aluno')
    const dia = await hoje(s.academiaId)
    const { rows } = await db.query(`${SELECT_COBRANCA} where c.aluno_id = $1 and c.academia_id = $2 order by c.competencia desc`, [id, s.academiaId])
    return { itens: rows.map((c) => cobrancaDto(c, dia)) }
  })

  app.post('/cobrancas/gerar', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const d = validar(z.object({ competencia: mes }), req.body)
    const competencia = `${d.competencia}-01`
    const limite = somaMeses(primeiroDoMes(await hoje(s.academiaId)), 1)
    if (competencia > limite) throw invalido('Só é possível gerar até o mês seguinte.', { competencia: 'Mês muito distante.' })
    const criadas = await comTransacao(db, async (c) => {
      const n = await gerarCobrancas(c, s.academiaId, competencia)
      await auditar(c, s, 'cobranca.gerar', 'cobranca', null, null, { competencia: d.competencia, criadas: n }, req.ip)
      return n
    })
    return { competencia: d.competencia, criadas }
  })

  // A baixa cria a transação e marca a cobrança como paga na MESMA transação de banco: nunca um sem o outro.
  app.post('/cobrancas/:id/pagar', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    const d = validar(z.object({ data: dataISO.optional(), metodo: z.enum(METODOS).optional(), categoriaId: uuid.optional() }), req.body ?? {})
    const dia = await hoje(s.academiaId)
    const data = d.data ?? dia
    if (data > dia) throw invalido('A data do pagamento não pode ser futura.', { data: 'Data futura.' })

    return comTransacao(db, async (c) => {
      const antes = (await c.query(`${SELECT_COBRANCA} where c.id = $1 and c.academia_id = $2 for update of c`, [id, s.academiaId])).rows[0]
      if (!antes) throw naoEncontrado('Cobrança')
      if (antes.status === 'paga') throw conflito('cobranca_ja_paga', 'Esta cobrança já foi paga.')
      if (antes.status === 'cancelada') throw conflito('cobranca_cancelada', 'Esta cobrança foi cancelada.')

      let categoriaId = d.categoriaId
      if (categoriaId) await conferirCategoria(c, s.academiaId, categoriaId, 'receita')
      else categoriaId = await categoriaMensalidades(c, s.academiaId)

      await c.query(`update cobranca set status = 'paga', pago_em = $2 where id = $1`, [id, data])
      // Cobrança de R$ 0 (plano gratuito) quita sem lançamento: a transação exige valor > 0.
      if (antes.valor_centavos > 0) {
        await c.query(
          `insert into transacao (academia_id, tipo, categoria_id, descricao, valor_centavos, data, metodo, aluno_id, cobranca_id, criado_por)
           values ($1,'receita',$2,$3,$4,$5,$6,$7,$8,$9)`,
          [s.academiaId, categoriaId, `Mensalidade ${String(antes.competencia).slice(0, 7)} — ${antes.aluno_nome}`, antes.valor_centavos, data, d.metodo ?? 'pix', antes.aluno_id, id, s.usuarioId],
        )
      }
      const depois = (await c.query(`${SELECT_COBRANCA} where c.id = $1`, [id])).rows[0]
      await auditar(c, s, 'cobranca.pagar', 'cobranca', id, cobrancaDto(antes, dia), cobrancaDto(depois, dia), req.ip)
      return cobrancaDto(depois, dia)
    })
  })

  app.post('/cobrancas/:id/estornar', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    const dia = await hoje(s.academiaId)
    return comTransacao(db, async (c) => {
      const antes = (await c.query(`${SELECT_COBRANCA} where c.id = $1 and c.academia_id = $2 for update of c`, [id, s.academiaId])).rows[0]
      if (!antes) throw naoEncontrado('Cobrança')
      if (antes.status !== 'paga') throw conflito('cobranca_nao_paga', 'Só é possível desfazer a baixa de uma cobrança paga.')
      await c.query('delete from transacao where cobranca_id = $1', [id])
      await c.query(`update cobranca set status = 'aberta', pago_em = null where id = $1`, [id])
      const depois = (await c.query(`${SELECT_COBRANCA} where c.id = $1`, [id])).rows[0]
      await auditar(c, s, 'cobranca.estornar', 'cobranca', id, cobrancaDto(antes, dia), cobrancaDto(depois, dia), req.ip)
      return cobrancaDto(depois, dia)
    })
  })

  app.post('/cobrancas/:id/cancelar', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    const dia = await hoje(s.academiaId)
    return comTransacao(db, async (c) => {
      const antes = (await c.query(`${SELECT_COBRANCA} where c.id = $1 and c.academia_id = $2 for update of c`, [id, s.academiaId])).rows[0]
      if (!antes) throw naoEncontrado('Cobrança')
      if (antes.status !== 'aberta') throw conflito('cobranca_nao_aberta', 'Só é possível cancelar uma cobrança em aberto.')
      await c.query(`update cobranca set status = 'cancelada' where id = $1`, [id])
      const depois = (await c.query(`${SELECT_COBRANCA} where c.id = $1`, [id])).rows[0]
      await auditar(c, s, 'cobranca.cancelar', 'cobranca', id, cobrancaDto(antes, dia), cobrancaDto(depois, dia), req.ip)
      return cobrancaDto(depois, dia)
    })
  })

  // A situação de pagamento do aluno é calculada, não gravada. Esta lista agrupa as cobranças vencidas por aluno.
  app.get('/inadimplencia', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const dia = await hoje(s.academiaId)
    const { rows } = await db.query(
      `select a.id as aluno_id, a.nome, a.telefone, a.email, a.responsavel_nome, a.responsavel_telefone,
              count(*)::int as cobrancas, sum(c.valor_centavos)::int as total_centavos, min(c.vencimento) as mais_antigo
         from cobranca c join aluno a on a.id = c.aluno_id
        where c.academia_id = $1 and c.status = 'aberta' and c.vencimento < $2::date and a.anonimizado_em is null
        group by a.id order by min(c.vencimento), a.nome`,
      [s.academiaId, dia],
    )
    const itens = rows.map((r) => ({
      alunoId: r.aluno_id as string,
      nome: r.nome as string,
      telefone: (r.responsavel_telefone ?? r.telefone ?? null) as string | null,
      email: (r.email ?? null) as string | null,
      cobrancas: r.cobrancas as number,
      totalCentavos: r.total_centavos as number,
      maisAntigoVencimento: r.mais_antigo as string,
      diasAtraso: Math.round((Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${r.mais_antigo}T00:00:00Z`)) / 86_400_000),
    }))
    return { itens, totalCentavos: itens.reduce((t, i) => t + i.totalCentavos, 0) }
  })

  // ------------------------------------------------------------- transações ----

  app.get('/transacoes', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const f = validar(
      z.object({
        mes: mes.optional(),
        tipo: z.enum(['receita', 'despesa']).optional(),
        pagina: z.coerce.number().int().min(1).default(1),
        limite: z.coerce.number().int().min(1).max(500).default(100),
      }),
      req.query,
    )
    const params: unknown[] = [s.academiaId]
    const where = ['t.academia_id = $1']
    if (f.mes) {
      params.push(`${f.mes}-01`)
      where.push(`t.data >= $${params.length}::date and t.data < ($${params.length}::date + interval '1 month')`)
    }
    if (f.tipo) {
      params.push(f.tipo)
      where.push(`t.tipo = $${params.length}`)
    }
    const sql = where.join(' and ')
    const tot = (
      await db.query(
        `select coalesce(sum(valor_centavos) filter (where tipo = 'receita'), 0)::int as receita,
                coalesce(sum(valor_centavos) filter (where tipo = 'despesa'), 0)::int as despesa, count(*)::int as n
           from transacao t where ${sql}`,
        params,
      )
    ).rows[0]
    const { rows } = await db.query(
      `${SELECT_TRANSACAO} where ${sql} order by t.data desc, t.criado_em desc limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, f.limite, (f.pagina - 1) * f.limite],
    )
    return {
      itens: rows.map(transacaoDto),
      total: tot.n as number,
      pagina: f.pagina,
      limite: f.limite,
      resumo: { receitaCentavos: tot.receita as number, despesaCentavos: tot.despesa as number, saldoCentavos: (tot.receita - tot.despesa) as number },
    }
  })

  app.post('/transacoes', { preHandler: gestor }, async (req, reply) => {
    const s = sessaoDe(req)
    const d = validar(corpoTransacao, req.body)
    await conferirCategoria(db, s.academiaId, d.categoriaId, d.tipo)
    await conferirAluno(db, s.academiaId, d.alunoId)
    const { rows } = await db.query(
      `insert into transacao (academia_id, tipo, categoria_id, descricao, valor_centavos, data, metodo, aluno_id, conciliada, criado_por)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [s.academiaId, d.tipo, d.categoriaId, d.descricao, d.valorCentavos, d.data, d.metodo ?? 'pix', d.alunoId ?? null, d.conciliada ?? false, s.usuarioId],
    )
    const nova = transacaoDto((await db.query(`${SELECT_TRANSACAO} where t.id = $1`, [rows[0].id])).rows[0])
    await auditar(db, s, 'transacao.criar', 'transacao', nova.id, null, nova, req.ip)
    return reply.status(201).send(nova)
  })

  app.patch('/transacoes/:id', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    const d = validar(corpoTransacao.partial(), req.body)
    const antesLinha = (await db.query(`${SELECT_TRANSACAO} where t.id = $1 and t.academia_id = $2`, [id, s.academiaId])).rows[0]
    if (!antesLinha) throw naoEncontrado('Lançamento')
    // Lançamento de baixa de cobrança só muda descrição, categoria e conciliação: valor, data e tipo vêm da cobrança.
    if (antesLinha.cobranca_id && (d.valorCentavos !== undefined || d.data !== undefined || d.tipo !== undefined || d.alunoId !== undefined)) {
      throw conflito('transacao_de_cobranca', 'Este lançamento veio da baixa de uma cobrança. Desfaça a baixa para alterar valor ou data.')
    }
    const tipo = d.tipo ?? antesLinha.tipo
    const categoriaId = d.categoriaId ?? antesLinha.categoria_id
    if (d.categoriaId || d.tipo) await conferirCategoria(db, s.academiaId, categoriaId, tipo)
    if (d.alunoId) await conferirAluno(db, s.academiaId, d.alunoId)
    await db.query(
      `update transacao set tipo=$3, categoria_id=$4, descricao=$5, valor_centavos=$6, data=$7, metodo=$8, aluno_id=$9, conciliada=$10
        where id=$1 and academia_id=$2`,
      [
        id, s.academiaId, tipo, categoriaId, d.descricao ?? antesLinha.descricao, d.valorCentavos ?? antesLinha.valor_centavos,
        d.data ?? antesLinha.data, d.metodo ?? antesLinha.metodo, d.alunoId === undefined ? antesLinha.aluno_id : d.alunoId,
        d.conciliada ?? antesLinha.conciliada,
      ],
    )
    const depois = transacaoDto((await db.query(`${SELECT_TRANSACAO} where t.id = $1`, [id])).rows[0])
    await auditar(db, s, 'transacao.atualizar', 'transacao', id, transacaoDto(antesLinha), depois, req.ip)
    return depois
  })

  app.delete('/transacoes/:id', { preHandler: gestor }, async (req, reply) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    const antes = (await db.query(`${SELECT_TRANSACAO} where t.id = $1 and t.academia_id = $2`, [id, s.academiaId])).rows[0]
    if (!antes) throw naoEncontrado('Lançamento')
    if (antes.cobranca_id) throw conflito('transacao_de_cobranca', 'Este lançamento veio da baixa de uma cobrança. Desfaça a baixa da cobrança.')
    await comTransacao(db, async (c) => {
      await c.query('delete from transacao where id = $1', [id])
      await auditar(c, s, 'transacao.remover', 'transacao', id, transacaoDto(antes), null, req.ip)
    })
    return reply.status(204).send()
  })
}
