import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Contexto } from '../app.js'
import { auditar } from '../auditoria.js'
import { exigir, sessaoDe, type Sessao } from '../auth/sessao.js'
import { diaDaSemana, hojeNoFuso } from '../datas.js'
import { comTransacao, type Executor } from '../db/pool.js'
import { conflito, invalido, naoEncontrado, semPermissao } from '../erros.js'
import { dataISO, uuid, validar } from '../validacao.js'

type Linha = Record<string, any>

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null)

const registroDto = (r: Linha) => ({
  status: r.status as 'presente' | 'ausente' | 'justificado',
  origem: r.origem as 'aluno' | 'professor',
  registradoEm: iso(r.registrado_em),
  observacao: (r.observacao ?? null) as string | null,
})

export async function rotasPresenca(app: FastifyInstance, ctx: Contexto) {
  const { db } = ctx
  const equipe = exigir('gestor', 'professor')

  async function hoje(s: Sessao) {
    const fuso = (await db.query('select fuso from academia where id = $1', [s.academiaId])).rows[0].fuso as string
    return hojeNoFuso(ctx.agora(), fuso)
  }

  async function carregarAula(ex: Executor, academiaId: string, aulaId: string) {
    const aula = (await ex.query('select * from aula where id = $1 and academia_id = $2', [aulaId, academiaId])).rows[0]
    if (!aula) throw naoEncontrado('Aula')
    return aula as Linha
  }

  /** Cria a ocorrência concreta da aula na data, se ainda não existe (idempotente e seguro sob concorrência). */
  async function garantirChamada(ex: Executor, academiaId: string, aulaId: string, data: string) {
    const { rows } = await ex.query(
      `insert into chamada (academia_id, aula_id, data) values ($1,$2,$3)
       on conflict (aula_id, data) do update set aula_id = excluded.aula_id returning *`,
      [academiaId, aulaId, data],
    )
    return rows[0] as Linha
  }

  const params = z.object({ aulaId: uuid })

  // ------------------------------------------------------ lado do aluno ----

  /** Aulas de hoje das turmas do aluno, com o estado do check-in de cada uma. */
  app.get('/checkin/hoje', { preHandler: exigir('aluno') }, async (req) => {
    const s = sessaoDe(req)
    const dia = await hoje(s)
    const { rows } = await db.query(
      `select au.id, au.titulo, au.inicio, au.fim, au.local, au.turma_id, ch.cancelada, ch.motivo,
              p.status, p.origem, p.registrado_em, p.observacao
         from aula au
         join aluno_turma at on at.turma_id = au.turma_id and at.aluno_id = $1
                            and at.desde <= $3::date and (at.ate is null or at.ate >= $3::date)
         left join chamada ch on ch.aula_id = au.id and ch.data = $3::date
         left join presenca p on p.chamada_id = ch.id and p.aluno_id = $1
        where au.academia_id = $2 and au.ativa and au.dia_semana = $4
        order by au.inicio`,
      [s.alunoId, s.academiaId, dia, diaDaSemana(dia)],
    )
    return {
      data: dia,
      itens: rows.map((r) => ({
        aulaId: r.id,
        turmaId: r.turma_id,
        titulo: r.titulo,
        inicio: String(r.inicio).slice(0, 5),
        fim: String(r.fim).slice(0, 5),
        local: r.local,
        cancelada: !!r.cancelada,
        motivo: r.motivo ?? null,
        registro: r.status ? registroDto(r) : null,
      })),
    }
  })

  // O aluno só age em si mesmo e só na data de hoje, calculada no servidor (o cliente não informa a data).
  app.post('/aulas/:aulaId/checkin', { preHandler: exigir('aluno') }, async (req, reply) => {
    const s = sessaoDe(req)
    const { aulaId } = validar(params, req.params)
    const dia = await hoje(s)
    const aula = await carregarAula(db, s.academiaId, aulaId)
    if (!aula.ativa || aula.dia_semana !== diaDaSemana(dia)) throw invalido('Esta aula não acontece hoje.')

    const aluno = (await db.query('select status from aluno where id = $1 and academia_id = $2', [s.alunoId, s.academiaId])).rows[0]
    if (!aluno || aluno.status === 'inativo') throw semPermissao('Seu cadastro está inativo. Fale com a academia.')
    const vinculo = await db.query(
      `select 1 from aluno_turma where aluno_id = $1 and turma_id = $2 and desde <= $3::date and (ate is null or ate >= $3::date)`,
      [s.alunoId, aula.turma_id, dia],
    )
    if (!vinculo.rowCount) throw semPermissao('Você não faz parte da turma desta aula.')

    const registro = await comTransacao(db, async (c) => {
      const ch = await garantirChamada(c, s.academiaId, aulaId, dia)
      if (ch.cancelada) throw conflito('aula_cancelada', 'Esta aula foi cancelada.')
      // Idempotente: repetir o check-in não muda nada, e nunca sobrescreve uma correção do professor.
      await c.query(
        `insert into presenca (chamada_id, aluno_id, status, origem, registrado_por) values ($1,$2,'presente','aluno',$3)
         on conflict (chamada_id, aluno_id) do nothing`,
        [ch.id, s.alunoId, s.usuarioId],
      )
      return (await c.query('select * from presenca where chamada_id = $1 and aluno_id = $2', [ch.id, s.alunoId])).rows[0]
    })
    return reply.status(200).send({ aulaId, data: dia, registro: registroDto(registro) })
  })

  app.delete('/aulas/:aulaId/checkin', { preHandler: exigir('aluno') }, async (req, reply) => {
    const s = sessaoDe(req)
    const { aulaId } = validar(params, req.params)
    const dia = await hoje(s)
    await carregarAula(db, s.academiaId, aulaId)
    const ch = (await db.query('select id from chamada where aula_id = $1 and data = $2', [aulaId, dia])).rows[0]
    const p = ch && (await db.query('select origem from presenca where chamada_id = $1 and aluno_id = $2', [ch.id, s.alunoId])).rows[0]
    if (!p) return reply.status(204).send()
    if (p.origem !== 'aluno') throw conflito('registro_do_professor', 'Este registro foi feito pelo professor e só ele pode alterá-lo.')
    await db.query('delete from presenca where chamada_id = $1 and aluno_id = $2', [ch.id, s.alunoId])
    return reply.status(204).send()
  })

  // --------------------------------------------------- lado do professor ----

  const consulta = z.object({ aulaId: uuid, data: dataISO })

  /** Quem deveria estar na aula, com o que cada um fez. Quem não fez check-in aparece como "sem_checkin" (= falta). */
  app.get('/chamadas', { preHandler: equipe }, async (req) => {
    const s = sessaoDe(req)
    const { aulaId, data } = validar(consulta, req.query)
    const aula = await carregarAula(db, s.academiaId, aulaId)
    if (aula.dia_semana !== diaDaSemana(data)) throw invalido('Esta aula não acontece nesse dia da semana.', { data: 'Dia da semana diferente do horário da aula.' })

    const ch = (await db.query('select * from chamada where aula_id = $1 and data = $2', [aulaId, data])).rows[0]
    const { rows } = await db.query(
      `select a.id, a.nome, p.status, p.origem, p.registrado_em, p.observacao
         from aluno a
         left join presenca p on p.chamada_id = $4 and p.aluno_id = a.id
        where a.academia_id = $1
          and ((a.status <> 'inativo' and exists (
                 select 1 from aluno_turma at
                  where at.aluno_id = a.id and at.turma_id = $2 and at.desde <= $3::date and (at.ate is null or at.ate >= $3::date)))
               or p.aluno_id is not null)
        order by a.nome`,
      [s.academiaId, aula.turma_id, data, ch?.id ?? null],
    )
    const registros = rows.map((r) => ({
      alunoId: r.id as string,
      nome: r.nome as string,
      situacao: (r.status ?? 'sem_checkin') as 'presente' | 'ausente' | 'justificado' | 'sem_checkin',
      origem: (r.origem ?? null) as 'aluno' | 'professor' | null,
      registradoEm: iso(r.registrado_em),
      observacao: (r.observacao ?? null) as string | null,
    }))
    const cancelada = !!ch?.cancelada
    return {
      aulaId,
      data,
      cancelada,
      motivo: (ch?.motivo ?? null) as string | null,
      realizada: !cancelada && registros.some((r) => r.situacao === 'presente'),
      registros,
    }
  })

  const rotaChamada = z.object({ aulaId: uuid, data: dataISO })
  const corrigir = z.object({
    status: z.enum(['presente', 'ausente', 'justificado']),
    observacao: z.string().trim().max(300).optional(),
  })

  app.put('/chamadas/:aulaId/:data/presencas/:alunoId', { preHandler: equipe }, async (req) => {
    const s = sessaoDe(req)
    const { aulaId, data, alunoId } = validar(rotaChamada.extend({ alunoId: uuid }), req.params)
    const d = validar(corrigir, req.body)
    const aula = await carregarAula(db, s.academiaId, aulaId)
    if (aula.dia_semana !== diaDaSemana(data)) throw invalido('Esta aula não acontece nesse dia da semana.')
    if (data > (await hoje(s))) throw invalido('Não é possível registrar presença em data futura.')
    const aluno = (await db.query('select 1 from aluno where id = $1 and academia_id = $2', [alunoId, s.academiaId])).rowCount
    if (!aluno) throw naoEncontrado('Aluno')

    const depois = await comTransacao(db, async (c) => {
      const ch = await garantirChamada(c, s.academiaId, aulaId, data)
      if (ch.cancelada) throw conflito('aula_cancelada', 'Esta aula está cancelada. Reative-a antes de corrigir presenças.')
      const antes = (await c.query('select * from presenca where chamada_id = $1 and aluno_id = $2', [ch.id, alunoId])).rows[0]
      const { rows } = await c.query(
        `insert into presenca (chamada_id, aluno_id, status, origem, registrado_em, registrado_por, observacao)
         values ($1,$2,$3,'professor', now(), $4, $5)
         on conflict (chamada_id, aluno_id) do update
           set status = excluded.status, origem = 'professor', registrado_em = now(),
               registrado_por = excluded.registrado_por, observacao = excluded.observacao
         returning *`,
        [ch.id, alunoId, d.status, s.usuarioId, d.observacao ?? null],
      )
      await auditar(c, s, 'presenca.corrigir', 'chamada', ch.id, antes ? { alunoId, ...registroDto(antes) } : { alunoId, status: 'sem_checkin' }, { alunoId, ...registroDto(rows[0]) }, req.ip)
      return rows[0]
    })
    return { aulaId, data, alunoId, registro: registroDto(depois) }
  })

  const cancelamento = z.object({ motivo: z.string().trim().min(2, 'Informe o motivo.').max(200) })

  app.post('/chamadas/:aulaId/:data/cancelar', { preHandler: equipe }, async (req) => {
    const s = sessaoDe(req)
    const { aulaId, data } = validar(rotaChamada, req.params)
    const { motivo } = validar(cancelamento, req.body)
    const aula = await carregarAula(db, s.academiaId, aulaId)
    if (aula.dia_semana !== diaDaSemana(data)) throw invalido('Esta aula não acontece nesse dia da semana.')
    await comTransacao(db, async (c) => {
      const ch = await garantirChamada(c, s.academiaId, aulaId, data)
      await c.query('update chamada set cancelada = true, cancelada_por = $2, motivo = $3 where id = $1', [ch.id, s.usuarioId, motivo])
      await auditar(c, s, 'chamada.cancelar', 'chamada', ch.id, { cancelada: ch.cancelada }, { cancelada: true, motivo }, req.ip)
    })
    return { aulaId, data, cancelada: true, motivo }
  })

  app.post('/chamadas/:aulaId/:data/reativar', { preHandler: equipe }, async (req) => {
    const s = sessaoDe(req)
    const { aulaId, data } = validar(rotaChamada, req.params)
    await carregarAula(db, s.academiaId, aulaId)
    await comTransacao(db, async (c) => {
      const ch = (await c.query('select * from chamada where aula_id = $1 and data = $2 for update', [aulaId, data])).rows[0]
      if (!ch?.cancelada) return
      await c.query('update chamada set cancelada = false, cancelada_por = null, motivo = null where id = $1', [ch.id])
      await auditar(c, s, 'chamada.reativar', 'chamada', ch.id, { cancelada: true, motivo: ch.motivo }, { cancelada: false }, req.ip)
    })
    return { aulaId, data, cancelada: false, motivo: null }
  })
}
