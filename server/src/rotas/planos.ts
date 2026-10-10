import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Contexto } from '../app.js'
import { auditar } from '../auditoria.js'
import { exigir, sessaoDe } from '../auth/sessao.js'
import { conflito, naoEncontrado } from '../erros.js'
import { uuid, validar } from '../validacao.js'

const corpo = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.').max(80),
  descricao: z.string().trim().max(300).optional(),
  valorCentavos: z.number().int('Use centavos inteiros.').min(0).max(100_000_00),
  periodicidade: z.enum(['mensal', 'trimestral', 'semestral', 'anual']).optional(),
  /** null = ilimitado */
  aulasPorSemana: z.number().int().min(1).max(14).nullable().optional(),
  ativo: z.boolean().optional(),
})

type Linha = {
  id: string
  nome: string
  descricao: string
  valor_centavos: number
  periodicidade: string
  aulas_por_semana: number | null
  ativo: boolean
}

export const planoDto = (p: Linha) => ({
  id: p.id,
  nome: p.nome,
  descricao: p.descricao,
  valorCentavos: p.valor_centavos,
  periodicidade: p.periodicidade,
  aulasPorSemana: p.aulas_por_semana,
  ativo: p.ativo,
})

export async function rotasPlanos(app: FastifyInstance, { db }: Contexto) {
  // O professor lê (o cadastro de aluno escolhe plano); só o gestor altera.
  app.get('/planos', { preHandler: exigir('gestor', 'professor') }, async (req) => {
    const s = sessaoDe(req)
    const { rows } = await db.query<Linha>('select * from plano where academia_id = $1 order by ativo desc, valor_centavos, nome', [
      s.academiaId,
    ])
    return { itens: rows.map(planoDto) }
  })

  app.post('/planos', { preHandler: exigir('gestor') }, async (req, reply) => {
    const s = sessaoDe(req)
    const d = validar(corpo, req.body)
    try {
      const { rows } = await db.query<Linha>(
        `insert into plano (academia_id, nome, descricao, valor_centavos, periodicidade, aulas_por_semana, ativo)
         values ($1,$2,$3,$4,$5,$6,$7) returning *`,
        [s.academiaId, d.nome, d.descricao ?? '', d.valorCentavos, d.periodicidade ?? 'mensal', d.aulasPorSemana ?? null, d.ativo ?? true],
      )
      const novo = planoDto(rows[0]!)
      await auditar(db, s, 'plano.criar', 'plano', novo.id, null, novo, req.ip)
      return reply.status(201).send(novo)
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw conflito('plano_duplicado', 'Já existe um plano com esse nome.')
      throw e
    }
  })

  app.patch('/planos/:id', { preHandler: exigir('gestor') }, async (req) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    const d = validar(corpo.partial(), req.body)
    const antes = (await db.query<Linha>('select * from plano where id = $1 and academia_id = $2', [id, s.academiaId])).rows[0]
    if (!antes) throw naoEncontrado('Plano')
    const mesclado = {
      nome: d.nome ?? antes.nome,
      descricao: d.descricao ?? antes.descricao,
      valor_centavos: d.valorCentavos ?? antes.valor_centavos,
      periodicidade: d.periodicidade ?? antes.periodicidade,
      aulas_por_semana: d.aulasPorSemana === undefined ? antes.aulas_por_semana : d.aulasPorSemana,
      ativo: d.ativo ?? antes.ativo,
    }
    try {
      const { rows } = await db.query<Linha>(
        `update plano set nome=$3, descricao=$4, valor_centavos=$5, periodicidade=$6, aulas_por_semana=$7, ativo=$8
          where id = $1 and academia_id = $2 returning *`,
        [id, s.academiaId, mesclado.nome, mesclado.descricao, mesclado.valor_centavos, mesclado.periodicidade, mesclado.aulas_por_semana, mesclado.ativo],
      )
      const depois = planoDto(rows[0]!)
      await auditar(db, s, 'plano.atualizar', 'plano', id, planoDto(antes), depois, req.ip)
      return depois
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw conflito('plano_duplicado', 'Já existe um plano com esse nome.')
      throw e
    }
  })
}
