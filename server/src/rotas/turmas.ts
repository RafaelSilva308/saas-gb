import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Contexto } from '../app.js'
import { auditar } from '../auditoria.js'
import { exigir, sessaoDe } from '../auth/sessao.js'
import { comTransacao, type Executor } from '../db/pool.js'
import { conflito, invalido, naoEncontrado } from '../erros.js'
import { uuid, validar } from '../validacao.js'

type Linha = Record<string, any>

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM.')

const corpoTurma = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.').max(80),
  professorId: z.preprocess((v) => (v === '' ? null : v), uuid.nullable()).optional(),
  faixaEtaria: z.string().trim().min(1).max(40).optional(),
  nivel: z.string().trim().min(1).max(40).optional(),
  infantil: z.boolean().optional(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor no formato #RRGGBB.').optional(),
  ativa: z.boolean().optional(),
})

const corpoAula = z.object({
  turmaId: uuid,
  titulo: z.string().trim().min(2, 'Informe o título.').max(80),
  diaSemana: z.number().int().min(0).max(6),
  inicio: hora,
  fim: hora,
  capacidade: z.number().int().min(1).max(500),
  local: z.string().trim().min(1).max(60).optional(),
  ativa: z.boolean().optional(),
})

export const turmaDto = (t: Linha) => ({
  id: t.id as string,
  nome: t.nome as string,
  professorId: (t.professor_id ?? null) as string | null,
  professor: (t.professor_nome ?? null) as string | null,
  faixaEtaria: t.faixa_etaria as string,
  nivel: t.nivel as string,
  infantil: t.infantil as boolean,
  cor: t.cor as string,
  ativa: t.ativa as boolean,
})

export const aulaDto = (a: Linha) => ({
  id: a.id as string,
  turmaId: a.turma_id as string,
  titulo: a.titulo as string,
  diaSemana: a.dia_semana as number,
  inicio: String(a.inicio).slice(0, 5),
  fim: String(a.fim).slice(0, 5),
  capacidade: a.capacidade as number,
  local: a.local as string,
  ativa: a.ativa as boolean,
})

const SELECT_TURMA = `select t.*, u.nome as professor_nome from turma t left join usuario u on u.id = t.professor_id`

async function conferirProfessor(db: Executor, academiaId: string, professorId?: string | null) {
  if (!professorId) return
  const r = await db.query(`select 1 from usuario where id = $1 and academia_id = $2 and papel in ('professor','gestor') and ativo`, [professorId, academiaId])
  if (!r.rowCount) throw invalido('Professor inexistente.', { professorId: 'Professor inexistente.' })
}

export async function rotasTurmas(app: FastifyInstance, { db }: Contexto) {
  const gestor = exigir('gestor')
  const equipe = exigir('gestor', 'professor')

  app.get('/turmas', { preHandler: exigir() }, async (req) => {
    const s = sessaoDe(req)
    const { rows } = await db.query(`${SELECT_TURMA} where t.academia_id = $1 order by t.ativa desc, t.nome`, [s.academiaId])
    return { itens: rows.map(turmaDto) }
  })

  app.post('/turmas', { preHandler: gestor }, async (req, reply) => {
    const s = sessaoDe(req)
    const d = validar(corpoTurma, req.body)
    await conferirProfessor(db, s.academiaId, d.professorId)
    try {
      const { rows } = await db.query(
        `insert into turma (academia_id, nome, professor_id, faixa_etaria, nivel, infantil, cor, ativa)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [s.academiaId, d.nome, d.professorId ?? null, d.faixaEtaria ?? 'Adulto', d.nivel ?? 'Livre', d.infantil ?? false, d.cor ?? '#1764a8', d.ativa ?? true],
      )
      const novo = turmaDto((await db.query(`${SELECT_TURMA} where t.id = $1`, [rows[0].id])).rows[0])
      await auditar(db, s, 'turma.criar', 'turma', novo.id, null, novo, req.ip)
      return reply.status(201).send(novo)
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw conflito('turma_duplicada', 'Já existe uma turma com esse nome.')
      throw e
    }
  })

  app.patch('/turmas/:id', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    const d = validar(corpoTurma.partial(), req.body)
    const antesLinha = (await db.query(`${SELECT_TURMA} where t.id = $1 and t.academia_id = $2`, [id, s.academiaId])).rows[0]
    if (!antesLinha) throw naoEncontrado('Turma')
    await conferirProfessor(db, s.academiaId, d.professorId)
    try {
      await db.query(
        `update turma set nome=$3, professor_id=$4, faixa_etaria=$5, nivel=$6, infantil=$7, cor=$8, ativa=$9
          where id=$1 and academia_id=$2`,
        [
          id, s.academiaId,
          d.nome ?? antesLinha.nome,
          d.professorId === undefined ? antesLinha.professor_id : d.professorId,
          d.faixaEtaria ?? antesLinha.faixa_etaria,
          d.nivel ?? antesLinha.nivel,
          d.infantil ?? antesLinha.infantil,
          d.cor ?? antesLinha.cor,
          d.ativa ?? antesLinha.ativa,
        ],
      )
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw conflito('turma_duplicada', 'Já existe uma turma com esse nome.')
      throw e
    }
    const depois = turmaDto((await db.query(`${SELECT_TURMA} where t.id = $1`, [id])).rows[0])
    await auditar(db, s, 'turma.atualizar', 'turma', id, turmaDto(antesLinha), depois, req.ip)
    return depois
  })

  // ---------------------------------------------------------------- aulas ----

  app.get('/aulas', { preHandler: exigir() }, async (req) => {
    const s = sessaoDe(req)
    const { rows } = await db.query('select * from aula where academia_id = $1 and ativa order by dia_semana, inicio', [s.academiaId])
    return { itens: rows.map(aulaDto) }
  })

  async function conferirTurma(executor: Executor, academiaId: string, turmaId: string) {
    const r = await executor.query('select 1 from turma where id = $1 and academia_id = $2', [turmaId, academiaId])
    if (!r.rowCount) throw invalido('Turma inexistente.', { turmaId: 'Turma inexistente.' })
  }

  app.post('/aulas', { preHandler: equipe }, async (req, reply) => {
    const s = sessaoDe(req)
    const d = validar(corpoAula, req.body)
    if (d.fim <= d.inicio) throw invalido('O fim deve ser depois do início.', { fim: 'O fim deve ser depois do início.' })
    await conferirTurma(db, s.academiaId, d.turmaId)
    const { rows } = await db.query(
      `insert into aula (academia_id, turma_id, titulo, dia_semana, inicio, fim, capacidade, local, ativa)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [s.academiaId, d.turmaId, d.titulo, d.diaSemana, d.inicio, d.fim, d.capacidade, d.local ?? 'Tatame 1', d.ativa ?? true],
    )
    const nova = aulaDto(rows[0])
    await auditar(db, s, 'aula.criar', 'aula', nova.id, null, nova, req.ip)
    return reply.status(201).send(nova)
  })

  app.patch('/aulas/:id', { preHandler: equipe }, async (req) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    const d = validar(corpoAula.partial(), req.body)
    const antes = (await db.query('select * from aula where id = $1 and academia_id = $2', [id, s.academiaId])).rows[0]
    if (!antes) throw naoEncontrado('Aula')
    if (d.turmaId) await conferirTurma(db, s.academiaId, d.turmaId)
    const inicio = d.inicio ?? String(antes.inicio).slice(0, 5)
    const fim = d.fim ?? String(antes.fim).slice(0, 5)
    if (fim <= inicio) throw invalido('O fim deve ser depois do início.', { fim: 'O fim deve ser depois do início.' })
    const { rows } = await db.query(
      `update aula set turma_id=$3, titulo=$4, dia_semana=$5, inicio=$6, fim=$7, capacidade=$8, local=$9, ativa=$10
        where id=$1 and academia_id=$2 returning *`,
      [
        id, s.academiaId,
        d.turmaId ?? antes.turma_id, d.titulo ?? antes.titulo, d.diaSemana ?? antes.dia_semana,
        inicio, fim, d.capacidade ?? antes.capacidade, d.local ?? antes.local, d.ativa ?? antes.ativa,
      ],
    )
    const depois = aulaDto(rows[0])
    await auditar(db, s, 'aula.atualizar', 'aula', id, aulaDto(antes), depois, req.ip)
    return depois
  })

  // Aula com histórico de chamadas nunca some: vira inativa, e o histórico de frequência continua válido.
  app.delete('/aulas/:id', { preHandler: equipe }, async (req, reply) => {
    const s = sessaoDe(req)
    const { id } = validar(z.object({ id: uuid }), req.params)
    const antes = (await db.query('select * from aula where id = $1 and academia_id = $2', [id, s.academiaId])).rows[0]
    if (!antes) throw naoEncontrado('Aula')
    await comTransacao(db, async (c) => {
      const tem = (await c.query('select 1 from chamada where aula_id = $1 limit 1', [id])).rowCount
      if (tem) await c.query('update aula set ativa = false where id = $1', [id])
      else await c.query('delete from aula where id = $1', [id])
      await auditar(c, s, tem ? 'aula.desativar' : 'aula.remover', 'aula', id, aulaDto(antes), null, req.ip)
    })
    return reply.status(204).send()
  })
}
