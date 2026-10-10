import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Contexto } from '../app.js'
import { auditar } from '../auditoria.js'
import { exigir, sessaoDe } from '../auth/sessao.js'
import { hojeNoFuso } from '../datas.js'
import { comTransacao } from '../db/pool.js'
import { invalido } from '../erros.js'
import { interpretarLinhas, lerCsv, type AlunoImportado } from '../importacao.js'
import { validar } from '../validacao.js'

const MAX_LINHAS = 1000

export async function rotasImportacao(app: FastifyInstance, ctx: Contexto) {
  const { db } = ctx

  /**
   * Importa alunos de um CSV (cabeçalho obrigatório com "nome"). Por padrão só SIMULA: devolve totais e as linhas
   * rejeitadas sem gravar nada. Com `simular: false` grava todas as linhas válidas de uma vez.
   * Consentimento LGPD só é registrado se o gestor informar `consentimentoPor` (ex.: "Ficha de matrícula em papel").
   */
  app.post('/alunos/importar', { preHandler: exigir('gestor'), bodyLimit: 2 * 1024 * 1024 }, async (req) => {
    const s = sessaoDe(req)
    const d = validar(
      z.object({
        csv: z.string().min(1, 'Envie o conteúdo do arquivo.').max(1_500_000, 'Arquivo grande demais.'),
        simular: z.boolean().default(true),
        consentimentoPor: z.string().trim().min(2).max(120).optional(),
      }),
      req.body,
    )
    const fuso = (await db.query('select fuso from academia where id = $1', [s.academiaId])).rows[0].fuso as string
    const hoje = hojeNoFuso(ctx.agora(), fuso)

    const linhasCsv = lerCsv(d.csv)
    if (linhasCsv.length - 1 > MAX_LINHAS) throw invalido(`O arquivo tem mais de ${MAX_LINHAS} linhas. Divida em partes.`)
    const lido = interpretarLinhas(linhasCsv, hoje)
    if ('erro' in lido) throw invalido(lido.erro)

    const planos = new Map(
      (await db.query('select id, lower(nome) as nome from plano where academia_id = $1', [s.academiaId])).rows.map((p) => [p.nome as string, p.id as string]),
    )
    const existentes = (
      await db.query(`select lower(email) as email, lower(nome) as nome, nascimento::text as nascimento from aluno where academia_id = $1 and anonimizado_em is null`, [s.academiaId])
    ).rows
    const emails = new Set(existentes.map((a) => a.email).filter(Boolean) as string[])
    const nomesNasc = new Set(existentes.filter((a) => !a.email && a.nascimento).map((a) => `${a.nome}|${a.nascimento}`))

    const validas: (AlunoImportado & { planoId: string | null })[] = []
    const rejeitadas: { linha: number; motivo: string }[] = []
    for (const l of lido.linhas) {
      if (!l.ok) {
        rejeitadas.push({ linha: l.linha, motivo: l.motivo })
        continue
      }
      const a = l.aluno
      const planoId = a.planoNome ? (planos.get(a.planoNome.toLowerCase()) ?? null) : null
      if (a.planoNome && !planoId) {
        rejeitadas.push({ linha: l.linha, motivo: `Plano não encontrado: ${a.planoNome}` })
        continue
      }
      const chave = a.email ?? (a.nascimento ? `${a.nome.toLowerCase()}|${a.nascimento}` : null)
      const repetido = a.email ? emails.has(a.email) : chave ? nomesNasc.has(chave) : false
      if (repetido) {
        rejeitadas.push({ linha: l.linha, motivo: a.email ? `E-mail já cadastrado: ${a.email}` : 'Aluno já cadastrado (mesmo nome e nascimento).' })
        continue
      }
      if (a.email) emails.add(a.email)
      else if (chave) nomesNasc.add(chave)
      validas.push({ ...a, planoId })
    }

    const resposta = {
      simulacao: d.simular,
      colunasReconhecidas: lido.colunasReconhecidas,
      totais: { linhas: lido.linhas.length, validas: validas.length, rejeitadas: rejeitadas.length },
      rejeitadas,
      criados: 0,
    }
    if (d.simular || !validas.length) return resposta

    await comTransacao(db, async (c) => {
      for (const a of validas) {
        const matricula = a.matriculaEm ?? hoje
        const { rows } = await c.query(
          `insert into aluno (academia_id, nome, email, telefone, nascimento, faixa, graus, status, matricula_em, plano_id,
                              vencimento_dia, responsavel_nome, responsavel_telefone, observacoes, consentimento_em, consentimento_por)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id`,
          [
            s.academiaId, a.nome, a.email, a.telefone, a.nascimento, a.faixa, a.graus, a.status, matricula, a.planoId,
            a.vencimentoDia, a.responsavelNome, a.responsavelTelefone, a.observacoes,
            d.consentimentoPor ? new Date() : null, d.consentimentoPor ?? null,
          ],
        )
        await c.query(
          `insert into graduacao (academia_id, aluno_id, faixa, graus, data, concedida_por, observacao) values ($1,$2,$3,$4,$5,$6,'Importação')`,
          [s.academiaId, rows[0].id, a.faixa, a.graus, matricula, s.usuarioId],
        )
      }
      await auditar(c, s, 'aluno.importar', 'aluno', null, null, { criados: validas.length, rejeitadas: rejeitadas.length }, req.ip)
    })
    return { ...resposta, criados: validas.length }
  })
}
