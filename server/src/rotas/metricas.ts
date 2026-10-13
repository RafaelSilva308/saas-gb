import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Contexto } from '../app.js'
import { exigir, sessaoDe, type Sessao } from '../auth/sessao.js'
import { horaNoFuso } from '../datas.js'
import { somaMeses, primeiroDoMes } from '../financeiro.js'
import { naoEncontrado } from '../erros.js'
import { validar } from '../validacao.js'

type Linha = Record<string, any>

const FAIXAS_EM_ORDEM = ['branca', 'cinza', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'marrom', 'preta'] as const

/**
 * REGRA PROVISÓRIA de elegibilidade para graduação (pendência E1 do ROADMAP: a academia ainda não definiu a sua).
 * Até lá: aluno ativo, com pelo menos `diasMinimos` desde a última graduação e `frequenciaMinima`% nos últimos 30 dias.
 * Após `grausPorFaixa` graus, o próximo passo é a faixa seguinte. É sugestão para o professor, nunca promove ninguém sozinha.
 */
export const REGRA_GRADUACAO = { diasMinimos: 90, frequenciaMinima: 70, grausPorFaixa: 4 } as const

const somaDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const pct = (parte: number, total: number) => (total > 0 ? Math.round((100 * parte) / total) : 0)

export async function rotasMetricas(app: FastifyInstance, ctx: Contexto) {
  const { db } = ctx
  const equipe = exigir('gestor', 'professor')
  const gestor = exigir('gestor')

  async function contexto(s: Sessao) {
    const fuso = (await db.query('select fuso from academia where id = $1', [s.academiaId])).rows[0].fuso as string
    const agora = ctx.agora()
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
    return { fuso, agora, hoje }
  }

  async function taxaPresenca(academiaId: string, hoje: string) {
    const r = (
      await db.query(
        `select coalesce(sum(pres), 0)::int as pres, coalesce(sum(base), 0)::int as base from (
           select count(*) filter (where p.status = 'presente') as pres,
                  count(ch.id) - count(*) filter (where p.status = 'justificado') as base
             from aluno a
             join aluno_turma at on at.aluno_id = a.id
             join aula au on au.turma_id = at.turma_id
             join v_aula_realizada ch on ch.aula_id = au.id and ch.data between $2::date - 30 and $2::date
                                     and ch.data >= at.desde and ch.data <= coalesce(at.ate, $2::date)
             left join presenca p on p.chamada_id = ch.id and p.aluno_id = a.id
            where a.academia_id = $1 and a.status = 'ativo' and a.anonimizado_em is null
            group by a.id) x`,
        [academiaId, hoje],
      )
    ).rows[0]
    return pct(r.pres, r.base)
  }

  /** Próxima aula (a partir de agora, no fuso da academia) entre as aulas ativas; `turmaIds` restringe a lista. */
  async function proximaAula(academiaId: string, fuso: string, agora: Date, hoje: string, turmaIds?: string[]) {
    const { rows } = await db.query(
      `select au.id, au.titulo, au.dia_semana, to_char(au.inicio, 'HH24:MI') as inicio, to_char(au.fim, 'HH24:MI') as fim,
              au.local, t.nome as turma
         from aula au join turma t on t.id = au.turma_id
        where au.academia_id = $1 and au.ativa and t.ativa and ($2::uuid[] is null or au.turma_id = any($2::uuid[]))
        order by au.inicio`,
      [academiaId, turmaIds ?? null],
    )
    const agoraHora = horaNoFuso(agora, fuso)
    const diaHoje = new Date(`${hoje}T00:00:00Z`).getUTCDay()
    for (let d = 0; d < 8; d++) {
      const dia = (diaHoje + d) % 7
      const aula = rows.find((a) => a.dia_semana === dia && (d > 0 || a.inicio > agoraHora))
      if (aula) {
        return { aulaId: aula.id as string, titulo: aula.titulo as string, turma: aula.turma as string, data: somaDias(hoje, d), inicio: aula.inicio as string, fim: aula.fim as string, local: aula.local as string, hoje: d === 0 }
      }
    }
    return null
  }

  app.get('/metricas/painel', async (req) => {
    const s = sessaoDe(req)
    const { fuso, agora, hoje } = await contexto(s)

    if (s.papel === 'aluno') {
      // O aluno só enxerga os próprios números (defeito 8 do ROADMAP): nada da academia inteira.
      const a = (
        await db.query(
          `select a.id, a.nome, a.faixa, a.graus, a.status, aluno_frequencia_30d(a.id, $2::date) as frequencia_30d,
                  aluno_status_pagamento(a.id, $2::date) as status_pagamento,
                  coalesce((select array_agg(turma_id) from aluno_turma where aluno_id = a.id and ate is null), '{}') as turma_ids,
                  (select count(*)::int from presenca p where p.aluno_id = a.id and p.status = 'presente') as presencas_total
             from aluno a where a.id = $1 and a.academia_id = $3`,
          [s.alunoId, hoje, s.academiaId],
        )
      ).rows[0]
      if (!a) throw naoEncontrado('Aluno')
      return {
        papel: 'aluno' as const,
        aluno: { id: a.id as string, nome: a.nome as string, faixa: a.faixa as string, graus: a.graus as number, status: a.status as string },
        frequencia30d: a.frequencia_30d as number,
        statusPagamento: a.status_pagamento as string,
        presencasTotal: a.presencas_total as number,
        proximaAula: await proximaAula(s.academiaId, fuso, agora, hoje, a.turma_ids as string[]),
      }
    }

    const ativos = (await db.query(`select count(*)::int as n from aluno where academia_id = $1 and status = 'ativo' and anonimizado_em is null`, [s.academiaId])).rows[0].n as number
    const risco = (
      await db.query(
        `select a.id, a.nome, (select max(ch.data) from presenca p join chamada ch on ch.id = p.chamada_id
                                where p.aluno_id = a.id and p.status = 'presente') as ultima_presenca
           from aluno a
          where a.academia_id = $1 and a.status = 'ativo' and a.anonimizado_em is null
            and exists (select 1 from aluno_turma t where t.aluno_id = a.id and t.ate is null)
            and not exists (select 1 from presenca p join chamada ch on ch.id = p.chamada_id
                             where p.aluno_id = a.id and p.status = 'presente' and ch.data >= $2::date - 14)
          order by 3 nulls first, a.nome`,
        [s.academiaId, hoje],
      )
    ).rows
    const base = {
      alunosAtivos: ativos,
      taxaPresenca30d: await taxaPresenca(s.academiaId, hoje),
      emRiscoDeEvasao: { total: risco.length, itens: risco.slice(0, 10).map((r) => ({ alunoId: r.id as string, nome: r.nome as string, ultimaPresenca: (r.ultima_presenca ?? null) as string | null })) },
      proximaAula: await proximaAula(s.academiaId, fuso, agora, hoje),
    }
    if (s.papel === 'professor') return { papel: 'professor' as const, ...base }

    const mes = primeiroDoMes(hoje)
    const f = (
      await db.query(
        `select coalesce(sum(valor_centavos) filter (where tipo = 'receita' and data >= $2::date and data < $2::date + interval '1 month'), 0)::int as receita,
                coalesce(sum(valor_centavos) filter (where tipo = 'despesa' and data >= $2::date and data < $2::date + interval '1 month'), 0)::int as despesa,
                coalesce(sum(valor_centavos) filter (where tipo = 'receita' and data >= $3::date and data < $2::date), 0)::int as receita_anterior
           from transacao where academia_id = $1`,
        [s.academiaId, mes, somaMeses(mes, -1)],
      )
    ).rows[0]
    const inad = (
      await db.query(
        `select count(distinct aluno_id)::int as alunos, coalesce(sum(valor_centavos), 0)::int as total
           from cobranca where academia_id = $1 and status = 'aberta' and vencimento < $2::date`,
        [s.academiaId, hoje],
      )
    ).rows[0]
    const vencendo = (
      await db.query(
        `select count(distinct aluno_id)::int as alunos from cobranca
          where academia_id = $1 and status = 'aberta' and vencimento >= $2::date and vencimento <= $2::date + 5`,
        [s.academiaId, hoje],
      )
    ).rows[0].alunos as number
    // Receita recorrente mensal contratada: planos mais longos entram divididos pelo ciclo.
    const mrr = (
      await db.query(
        `select coalesce(round(sum(p.valor_centavos::numeric / case p.periodicidade when 'mensal' then 1 when 'trimestral' then 3 when 'semestral' then 6 else 12 end)), 0)::int as mrr
           from aluno a join plano p on p.id = a.plano_id
          where a.academia_id = $1 and a.status = 'ativo' and a.anonimizado_em is null`,
        [s.academiaId],
      )
    ).rows[0].mrr as number
    const novas = (
      await db.query(`select count(*)::int as n from aluno where academia_id = $1 and matricula_em >= $2::date and matricula_em < $2::date + interval '1 month'`, [s.academiaId, mes])
    ).rows[0].n as number

    return {
      papel: 'gestor' as const,
      ...base,
      novasMatriculasMes: novas,
      mrrCentavos: mrr,
      inadimplentes: { alunos: inad.alunos as number, valorEmAbertoCentavos: inad.total as number },
      vencendoEmBreve: vencendo,
      fluxoDoMes: { receitaCentavos: f.receita as number, despesaCentavos: f.despesa as number, resultadoCentavos: (f.receita - f.despesa) as number },
      variacaoReceitaPct: f.receita_anterior ? Math.round((100 * (f.receita - f.receita_anterior)) / f.receita_anterior) : null,
    }
  })

  app.get('/metricas/financeiro', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { meses } = validar(z.object({ meses: z.coerce.number().int().min(1).max(24).default(6) }), req.query)
    const { hoje } = await contexto(s)
    const inicio = somaMeses(primeiroDoMes(hoje), -(meses - 1))
    const { rows } = await db.query(
      `select to_char(m, 'YYYY-MM') as mes,
              coalesce(sum(t.valor_centavos) filter (where t.tipo = 'receita'), 0)::int as receita,
              coalesce(sum(t.valor_centavos) filter (where t.tipo = 'despesa'), 0)::int as despesa
         from generate_series($2::date, $2::date + make_interval(months => $3::int - 1), interval '1 month') m
         left join transacao t on t.academia_id = $1 and t.data >= m and t.data < m + interval '1 month'
        group by m order by m`,
      [s.academiaId, inicio, meses],
    )
    return { itens: rows.map((r) => ({ mes: r.mes as string, receitaCentavos: r.receita as number, despesaCentavos: r.despesa as number, resultadoCentavos: (r.receita - r.despesa) as number })) }
  })

  app.get('/metricas/presenca', { preHandler: equipe }, async (req) => {
    const s = sessaoDe(req)
    const { semanas } = validar(z.object({ semanas: z.coerce.number().int().min(1).max(26).default(8) }), req.query)
    const { hoje } = await contexto(s)
    const { rows } = await db.query(
      `with sem as (
         select i, $2::date - 7 * ($3::int - i) + 1 as ini, $2::date - 7 * ($3::int - i - 1) as fim from generate_series(0, $3::int - 1) i)
       select sem.i, sem.ini, count(*) filter (where p.status = 'presente')::int as pres,
              count(*) filter (where p.status = 'justificado')::int as just, count(at.aluno_id)::int as previstos
         from sem
         left join v_aula_realizada ch on ch.academia_id = $1 and ch.data between sem.ini and sem.fim
         left join aula au on au.id = ch.aula_id
         left join aluno_turma at on at.turma_id = au.turma_id and ch.data >= at.desde and ch.data <= coalesce(at.ate, ch.data)
         left join presenca p on p.chamada_id = ch.id and p.aluno_id = at.aluno_id
        group by sem.i, sem.ini order by sem.i`,
      [s.academiaId, hoje, semanas],
    )
    return { itens: rows.map((r) => ({ inicio: r.ini as string, presencas: r.pres as number, taxa: pct(r.pres, r.previstos - r.just) })) }
  })

  // Só contagens agregadas, sem nomes: qualquer papel logado pode ver.
  app.get('/metricas/faixas', async (req) => {
    const s = sessaoDe(req)
    const { rows } = await db.query(
      `select faixa, count(*)::int as qtd from aluno where academia_id = $1 and status = 'ativo' and anonimizado_em is null group by faixa`,
      [s.academiaId],
    )
    const total = rows.reduce((t, r) => t + (r.qtd as number), 0)
    const itens = rows
      .map((r) => ({ faixa: r.faixa as string, qtd: r.qtd as number, pct: pct(r.qtd, total) }))
      .sort((a, b) => b.qtd - a.qtd || FAIXAS_EM_ORDEM.indexOf(a.faixa as never) - FAIXAS_EM_ORDEM.indexOf(b.faixa as never))
    return { total, itens }
  })

  app.get('/metricas/ocupacao', { preHandler: equipe }, async (req) => {
    const s = sessaoDe(req)
    const { hoje } = await contexto(s)
    const { rows } = await db.query(
      `select t.id, t.nome, t.cor,
              coalesce((select avg(n)::float8 from (
                 select count(*) filter (where p.status = 'presente') as n
                   from chamada ch join aula au on au.id = ch.aula_id left join presenca p on p.chamada_id = ch.id
                  where au.turma_id = t.id and not ch.cancelada and ch.data between $2::date - 30 and $2::date
                  group by ch.id having count(*) filter (where p.status = 'presente') > 0) z), 0) as media,
              coalesce((select avg(capacidade)::float8 from aula where turma_id = t.id and ativa), 0) as capacidade
         from turma t where t.academia_id = $1 and t.ativa order by t.nome`,
      [s.academiaId, hoje],
    )
    return {
      itens: rows.map((r) => ({
        turmaId: r.id as string,
        turma: r.nome as string,
        cor: r.cor as string,
        mediaPresentes: Math.round(r.media),
        capacidade: Math.round(r.capacidade),
        ocupacaoPct: r.capacidade ? Math.round((100 * r.media) / r.capacidade) : 0,
      })),
    }
  })

  app.get('/graduacoes/elegiveis', { preHandler: equipe }, async (req) => {
    const s = sessaoDe(req)
    const { hoje } = await contexto(s)
    const { rows } = await db.query(
      `select a.id, a.nome, a.faixa, a.graus, aluno_frequencia_30d(a.id, $2::date) as freq,
              coalesce((select max(g.data) from graduacao g where g.aluno_id = a.id), a.matricula_em) as desde
         from aluno a
        where a.academia_id = $1 and a.status = 'ativo' and a.anonimizado_em is null and a.faixa <> 'preta'
        order by a.nome`,
      [s.academiaId, hoje],
    )
    const itens = rows
      .map((r) => {
        const dias = Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${r.desde}T00:00:00Z`)) / 86_400_000)
        const proxima =
          r.graus + 1 > REGRA_GRADUACAO.grausPorFaixa
            ? { faixa: FAIXAS_EM_ORDEM[FAIXAS_EM_ORDEM.indexOf(r.faixa) + 1] as string, graus: 0 }
            : { faixa: r.faixa as string, graus: (r.graus as number) + 1 }
        return { alunoId: r.id as string, nome: r.nome as string, faixa: r.faixa as string, graus: r.graus as number, proxima, diasDesdeUltima: dias, frequencia30d: r.freq as number }
      })
      .filter((i) => i.diasDesdeUltima >= REGRA_GRADUACAO.diasMinimos && i.frequencia30d >= REGRA_GRADUACAO.frequenciaMinima)
    return { regraProvisoria: REGRA_GRADUACAO, itens }
  })
}
