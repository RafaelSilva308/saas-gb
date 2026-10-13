import { hojeNoFuso } from './datas.js'
import type { Executor } from './db/pool.js'

/** Mês de uma data ISO, como `AAAA-MM-01`. */
export const primeiroDoMes = (iso: string) => `${iso.slice(0, 7)}-01`

export const somaMeses = (competencia: string, n: number) => {
  const [a, m] = competencia.split('-').map(Number) as [number, number]
  const total = a * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}

export async function hojeDaAcademia(db: Executor, agora: Date, academiaId: string): Promise<string> {
  const fuso = (await db.query('select fuso from academia where id = $1', [academiaId])).rows[0]?.fuso as string | undefined
  return hojeNoFuso(agora, fuso ?? 'America/Sao_Paulo')
}

/**
 * Gera a cobrança da competência (`AAAA-MM-01`) de cada aluno ativo com plano. Idempotente: `unique (aluno_id, competencia)`.
 *
 * - Plano trimestral/semestral/anual só gera cobrança nos meses em que o ciclo recomeça, contados a partir do mês da matrícula;
 *   `valor_centavos` do plano é o valor do ciclo inteiro.
 * - Se o dia de vencimento do primeiro mês já tinha passado na matrícula, o vencimento vai para o mês seguinte.
 * - Aluno experimental, inativo ou anonimizado não recebe cobrança.
 */
export async function gerarCobrancas(db: Executor, academiaId: string, competencia: string): Promise<number> {
  const r = await db.query(
    `with base as (
       select a.id as aluno_id, a.academia_id, p.id as plano_id, p.valor_centavos, a.matricula_em,
              make_date(extract(year from $2::date)::int, extract(month from $2::date)::int,
                        least(a.vencimento_dia, extract(day from ($2::date + interval '1 month - 1 day'))::int)) as venc,
              ((extract(year from $2::date) * 12 + extract(month from $2::date))
               - (extract(year from a.matricula_em) * 12 + extract(month from a.matricula_em)))::int as meses_desde,
              case p.periodicidade when 'mensal' then 1 when 'trimestral' then 3 when 'semestral' then 6 else 12 end as ciclo
         from aluno a join plano p on p.id = a.plano_id
        where a.academia_id = $1 and a.status = 'ativo' and a.anonimizado_em is null
     )
     insert into cobranca (academia_id, aluno_id, plano_id, competencia, vencimento, valor_centavos)
     select academia_id, aluno_id, plano_id, $2::date,
            case when venc < matricula_em then (venc + interval '1 month')::date else venc end,
            valor_centavos
       from base
      where meses_desde >= 0 and meses_desde % ciclo = 0
     on conflict (aluno_id, competencia) do nothing
     returning id`,
    [academiaId, competencia],
  )
  return r.rowCount ?? 0
}

/** Categoria padrão de receita das mensalidades; criada sob demanda. */
export async function categoriaMensalidades(db: Executor, academiaId: string): Promise<string> {
  await db.query(
    `insert into categoria_financeira (academia_id, tipo, nome) values ($1, 'receita', 'Mensalidades')
     on conflict (academia_id, tipo, nome) do nothing`,
    [academiaId],
  )
  return (
    await db.query(`select id from categoria_financeira where academia_id = $1 and tipo = 'receita' and nome = 'Mensalidades'`, [academiaId])
  ).rows[0].id as string
}

export const CATEGORIAS_PADRAO: readonly (readonly ['receita' | 'despesa', string])[] = [
  ['receita', 'Mensalidades'],
  ['receita', 'Matrícula'],
  ['receita', 'Venda de produtos'],
  ['receita', 'Eventos e camisetas'],
  ['despesa', 'Aluguel'],
  ['despesa', 'Salários'],
  ['despesa', 'Contas (água, luz, internet)'],
  ['despesa', 'Equipamentos e manutenção'],
  ['despesa', 'Marketing'],
  ['despesa', 'Outras despesas'],
]

export async function criarCategoriasPadrao(db: Executor, academiaId: string) {
  for (const [tipo, nome] of CATEGORIAS_PADRAO) {
    await db.query(
      `insert into categoria_financeira (academia_id, tipo, nome) values ($1,$2,$3) on conflict (academia_id, tipo, nome) do nothing`,
      [academiaId, tipo, nome],
    )
  }
}
