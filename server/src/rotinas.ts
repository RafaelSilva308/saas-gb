import type { Contexto } from './app.js'
import { diaDaSemana, hojeNoFuso } from './datas.js'
import { gerarCobrancas, primeiroDoMes } from './financeiro.js'

export const TIPOS_AVISO = ['vencimento', 'inadimplencia', 'aniversario', 'ausencia', 'resumo_semanal'] as const
export type TipoAviso = (typeof TIPOS_AVISO)[number]

/** Janelas provisórias dos avisos (pendência E9: a academia ainda não confirmou quais avisos quer). */
export const JANELAS = { diasAntesDoVencimento: 3, diasDepoisDoVencimento: 3, limiteAtraso: 30, diasSemPresenca: 14 } as const

const brl = (centavos: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100)
const dataBR = (iso: string) => iso.split('-').reverse().join('/')
const somarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

export interface ResumoRotinas {
  academias: number
  cobrancasGeradas: number
  enviados: number
  falhas: number
  jaEnviados: number
}

interface Envio {
  academiaId: string
  tipo: TipoAviso
  alunoId: string | null
  cobrancaId: string | null
  destinatario: string
  referencia: string | null
  assunto: string
  texto: string
}

/**
 * O registro em `envio_email` vem ANTES do envio. Os índices únicos fazem o segundo insert não gravar nada, então rodar a
 * rotina duas vezes (ou duas instâncias ao mesmo tempo) nunca duplica o aviso. Contrapartida aceita: se o processo cair
 * entre o registro e o envio, o aviso fica `pendente` e não é reenviado sozinho.
 */
async function enviarUmaVez(ctx: Contexto, e: Envio, r: ResumoRotinas) {
  const { rows } = await ctx.db.query(
    `insert into envio_email (academia_id, tipo, aluno_id, cobranca_id, destinatario, referencia)
     values ($1,$2,$3,$4,$5,$6) on conflict do nothing returning id`,
    [e.academiaId, e.tipo, e.alunoId, e.cobrancaId, e.destinatario, e.referencia],
  )
  if (!rows[0]) {
    r.jaEnviados++
    return
  }
  try {
    const provedorId = await ctx.mailer.enviar({ para: e.destinatario, assunto: e.assunto, texto: e.texto })
    await ctx.db.query(`update envio_email set status = 'enviado', provedor_id = $2 where id = $1`, [rows[0].id, provedorId ?? null])
    r.enviados++
  } catch (err) {
    await ctx.db.query(`update envio_email set status = 'falhou', erro = $2 where id = $1`, [rows[0].id, String((err as Error).message).slice(0, 500)])
    r.falhas++
  }
}

async function rotinasDaAcademia(ctx: Contexto, a: { id: string; nome: string; fuso: string }, forcar: boolean, r: ResumoRotinas) {
  const { db } = ctx
  const agora = ctx.agora()
  const hoje = hojeNoFuso(agora, a.fuso)
  const hora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: a.fuso, hour: '2-digit', hour12: false }).format(agora)) % 24
  if (!forcar && hora < ctx.config.horaDosAvisos) return

  r.cobrancasGeradas += await gerarCobrancas(db, a.id, primeiroDoMes(hoje))

  const ativos = new Set(
    (await db.query(`select tipo from config_aviso where academia_id = $1 and ativo`, [a.id])).rows.map((x) => x.tipo as TipoAviso),
  )
  const assinatura = `\n\n${a.nome}`
  const dow = diaDaSemana(hoje)
  const segunda = somarDias(hoje, -((dow + 6) % 7))

  const porCobranca = async (tipo: 'vencimento' | 'inadimplencia', de: string, ate: string) => {
    const { rows } = await db.query(
      `select c.id, c.aluno_id, c.vencimento::text as vencimento, c.valor_centavos, a.nome, a.email
         from cobranca c join aluno a on a.id = c.aluno_id
        where c.academia_id = $1 and c.status = 'aberta' and c.vencimento between $2::date and $3::date
          and a.email is not null and a.status = 'ativo' and a.anonimizado_em is null`,
      [a.id, de, ate],
    )
    for (const c of rows) {
      const aviso =
        tipo === 'vencimento'
          ? { assunto: `${a.nome} · sua mensalidade vence em ${dataBR(c.vencimento)}`, texto: `Olá, ${c.nome}.\n\nLembrando que a mensalidade de ${brl(c.valor_centavos)} vence em ${dataBR(c.vencimento)}.` }
          : { assunto: `${a.nome} · mensalidade em atraso`, texto: `Olá, ${c.nome}.\n\nA mensalidade de ${brl(c.valor_centavos)}, com vencimento em ${dataBR(c.vencimento)}, ainda não consta como paga. Se já pagou, desconsidere esta mensagem.` }
      await enviarUmaVez(ctx, { academiaId: a.id, tipo, alunoId: c.aluno_id, cobrancaId: c.id, destinatario: c.email, referencia: null, assunto: aviso.assunto, texto: aviso.texto + assinatura }, r)
    }
  }

  if (ativos.has('vencimento')) {
    const dia = somarDias(hoje, JANELAS.diasAntesDoVencimento)
    await porCobranca('vencimento', dia, dia)
  }
  if (ativos.has('inadimplencia')) {
    await porCobranca('inadimplencia', somarDias(hoje, -JANELAS.limiteAtraso), somarDias(hoje, -JANELAS.diasDepoisDoVencimento))
  }

  if (ativos.has('aniversario')) {
    const { rows } = await db.query(
      `select id, nome, email from aluno
        where academia_id = $1 and status = 'ativo' and anonimizado_em is null and email is not null and nascimento is not null
          and extract(month from nascimento) = extract(month from $2::date) and extract(day from nascimento) = extract(day from $2::date)`,
      [a.id, hoje],
    )
    for (const x of rows) {
      await enviarUmaVez(ctx, { academiaId: a.id, tipo: 'aniversario', alunoId: x.id, cobrancaId: null, destinatario: x.email, referencia: hoje, assunto: `${a.nome} · feliz aniversário, ${x.nome.split(' ')[0]}!`, texto: `Feliz aniversário, ${x.nome}! Um abraço de toda a equipe, e até o próximo treino.${assinatura}` }, r)
    }
  }

  if (ativos.has('ausencia')) {
    const { rows } = await db.query(
      `select a.id, a.nome, a.email from aluno a
        where a.academia_id = $1 and a.status = 'ativo' and a.anonimizado_em is null and a.email is not null
          and a.matricula_em <= $2::date - $3::int
          and exists (select 1 from aluno_turma t where t.aluno_id = a.id and t.ate is null)
          and not exists (select 1 from presenca p join chamada ch on ch.id = p.chamada_id
                           where p.aluno_id = a.id and p.status = 'presente' and ch.data >= $2::date - $3::int)`,
      [a.id, hoje, JANELAS.diasSemPresenca],
    )
    for (const x of rows) {
      await enviarUmaVez(ctx, { academiaId: a.id, tipo: 'ausencia', alunoId: x.id, cobrancaId: null, destinatario: x.email, referencia: segunda, assunto: `${a.nome} · sentimos sua falta`, texto: `Olá, ${x.nome}.\n\nFaz um tempo que você não aparece nos treinos. Quando puder, volte: a turma sente sua falta.${assinatura}` }, r)
    }
  }

  if (ativos.has('resumo_semanal') && dow === 1) {
    const m = (
      await db.query(
        `select (select count(*)::int from aluno where academia_id = $1 and status = 'ativo' and anonimizado_em is null) as ativos,
                (select count(distinct aluno_id)::int from cobranca where academia_id = $1 and status = 'aberta' and vencimento < $2::date) as inad,
                (select coalesce(sum(valor_centavos), 0)::int from cobranca where academia_id = $1 and status = 'aberta' and vencimento < $2::date) as inad_valor,
                (select coalesce(sum(valor_centavos), 0)::int from transacao where academia_id = $1 and tipo = 'receita' and data > $2::date - 7 and data <= $2::date) as receita`,
        [a.id, hoje],
      )
    ).rows[0]
    const gestores = (await db.query(`select email from usuario where academia_id = $1 and papel = 'gestor' and ativo`, [a.id])).rows
    for (const g of gestores) {
      await enviarUmaVez(ctx, {
        academiaId: a.id, tipo: 'resumo_semanal', alunoId: null, cobrancaId: null, destinatario: g.email, referencia: hoje,
        assunto: `${a.nome} · resumo da semana`,
        texto: `Resumo de ${dataBR(hoje)}:\n\n- Alunos ativos: ${m.ativos}\n- Receita nos últimos 7 dias: ${brl(m.receita)}\n- Em atraso: ${m.inad} aluno(s), ${brl(m.inad_valor)}${assinatura}`,
      }, r)
    }
  }
}

/** Gera as cobranças do mês e envia os avisos ligados em `config_aviso`. Idempotente. `forcar` ignora a hora mínima do dia. */
export async function executarRotinas(ctx: Contexto, opcoes: { academiaId?: string; forcar?: boolean } = {}): Promise<ResumoRotinas> {
  const r: ResumoRotinas = { academias: 0, cobrancasGeradas: 0, enviados: 0, falhas: 0, jaEnviados: 0 }
  const { rows } = await ctx.db.query(
    `select id, nome, fuso from academia where ($1::uuid is null or id = $1::uuid) order by criado_em`,
    [opcoes.academiaId ?? null],
  )
  for (const a of rows) {
    r.academias++
    await rotinasDaAcademia(ctx, a, opcoes.forcar ?? false, r)
  }
  return r
}

/** Verifica a cada `intervaloMs`; como tudo é idempotente, repetir a chamada no mesmo dia não duplica nada. */
export function iniciarAgendador(ctx: Contexto, intervaloMs = 15 * 60_000): () => void {
  let rodando = false
  const tick = async () => {
    if (rodando) return
    rodando = true
    try {
      const r = await executarRotinas(ctx)
      if (r.enviados || r.falhas || r.cobrancasGeradas) console.log('[rotinas]', JSON.stringify(r))
    } catch (e) {
      console.error('[rotinas] erro:', e)
    } finally {
      rodando = false
    }
  }
  const t = setInterval(tick, intervaloMs)
  t.unref()
  void tick()
  return () => clearInterval(t)
}
