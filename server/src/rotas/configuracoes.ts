import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Contexto } from '../app.js'
import { auditar } from '../auditoria.js'
import { exigir, sessaoDe } from '../auth/sessao.js'
import { invalido, naoEncontrado } from '../erros.js'
import { executarRotinas, TIPOS_AVISO } from '../rotinas.js'
import { validar } from '../validacao.js'

const fusoValido = (f: string) => {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: f })
    return true
  } catch {
    return false
  }
}

const dto = (a: Record<string, any>) => ({
  id: a.id as string,
  nome: a.nome as string,
  cnpj: (a.cnpj ?? null) as string | null,
  telefone: (a.telefone ?? null) as string | null,
  email: (a.email ?? null) as string | null,
  endereco: (a.endereco ?? null) as string | null,
  fuso: a.fuso as string,
})

const texto = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable().optional()

export async function rotasConfiguracoes(app: FastifyInstance, ctx: Contexto) {
  const { db } = ctx
  const gestor = exigir('gestor')

  app.get('/academia', { preHandler: exigir() }, async (req) => {
    const s = sessaoDe(req)
    const a = (await db.query('select * from academia where id = $1', [s.academiaId])).rows[0]
    if (!a) throw naoEncontrado('Academia')
    return dto(a)
  })

  app.patch('/academia', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const d = validar(
      z.object({
        nome: z.string().trim().min(2).max(120).optional(),
        cnpj: texto(20),
        telefone: texto(30),
        email: z.string().trim().toLowerCase().email('E-mail inválido.').max(200).nullable().optional(),
        endereco: texto(300),
        fuso: z.string().trim().max(60).optional(),
      }),
      req.body,
    )
    if (d.fuso !== undefined && !fusoValido(d.fuso)) throw invalido('Fuso horário desconhecido.', { fuso: 'Use um nome como America/Sao_Paulo.' })
    const antes = (await db.query('select * from academia where id = $1', [s.academiaId])).rows[0]
    const { rows } = await db.query(
      `update academia set nome=$2, cnpj=$3, telefone=$4, email=$5, endereco=$6, fuso=$7 where id=$1 returning *`,
      [
        s.academiaId,
        d.nome ?? antes.nome,
        d.cnpj === undefined ? antes.cnpj : d.cnpj,
        d.telefone === undefined ? antes.telefone : d.telefone,
        d.email === undefined ? antes.email : d.email,
        d.endereco === undefined ? antes.endereco : d.endereco,
        d.fuso ?? antes.fuso,
      ],
    )
    await auditar(db, s, 'academia.atualizar', 'academia', s.academiaId, dto(antes), dto(rows[0]), req.ip)
    return dto(rows[0])
  })

  app.get('/avisos', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { rows } = await db.query('select tipo, ativo from config_aviso where academia_id = $1', [s.academiaId])
    const mapa = new Map(rows.map((r) => [r.tipo as string, r.ativo as boolean]))
    // Sem linha = desligado: nenhum e-mail sai sem o gestor ter ligado o aviso (E9).
    return { itens: TIPOS_AVISO.map((tipo) => ({ tipo, ativo: mapa.get(tipo) ?? false })) }
  })

  app.put('/avisos/:tipo', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { tipo } = validar(z.object({ tipo: z.enum(TIPOS_AVISO) }), req.params)
    const { ativo } = validar(z.object({ ativo: z.boolean() }), req.body)
    const antes = (await db.query('select ativo from config_aviso where academia_id = $1 and tipo = $2', [s.academiaId, tipo])).rows[0]
    await db.query(
      `insert into config_aviso (academia_id, tipo, ativo) values ($1,$2,$3)
       on conflict (academia_id, tipo) do update set ativo = excluded.ativo`,
      [s.academiaId, tipo, ativo],
    )
    await auditar(db, s, 'aviso.configurar', 'config_aviso', null, { tipo, ativo: antes?.ativo ?? false }, { tipo, ativo }, req.ip)
    return { tipo, ativo }
  })

  app.get('/avisos/envios', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const { rows } = await db.query(
      `select e.id, e.tipo, e.status, e.destinatario, e.erro, e.criado_em, a.nome as aluno_nome
         from envio_email e left join aluno a on a.id = e.aluno_id
        where e.academia_id = $1 order by e.criado_em desc limit 100`,
      [s.academiaId],
    )
    return {
      itens: rows.map((r) => ({
        id: r.id as string,
        tipo: r.tipo as string,
        status: r.status as string,
        destinatario: r.destinatario as string,
        alunoNome: (r.aluno_nome ?? null) as string | null,
        erro: (r.erro ?? null) as string | null,
        criadoEm: new Date(r.criado_em).toISOString(),
      })),
    }
  })

  // Dispara agora as rotinas da própria academia (gera as cobranças do mês e envia os avisos ligados). Idempotente.
  app.post('/rotinas/executar', { preHandler: gestor }, async (req) => {
    const s = sessaoDe(req)
    const r = await executarRotinas(ctx, { academiaId: s.academiaId, forcar: true })
    await auditar(db, s, 'rotinas.executar', 'academia', s.academiaId, null, r, req.ip)
    return r
  })
}
