import { fileURLToPath } from 'node:url'
import { criarCategoriasPadrao } from '../financeiro.js'
import { comTransacao, criarPool, type Db } from './pool.js'

export interface NovaAcademia {
  nomeAcademia: string
  nomeGestor: string
  emailGestor: string
  fuso?: string
}

/**
 * Cria uma academia real (sem dados de demonstração): academia, categorias financeiras padrão e o primeiro gestor.
 * O gestor nasce sem senha; ele define a sua em "Esqueci minha senha" (o link vai por e-mail).
 */
export async function criarAcademia(db: Db, d: NovaAcademia): Promise<{ academiaId: string; gestorId: string }> {
  const email = d.emailGestor.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('E-mail do gestor inválido.')
  if (d.nomeAcademia.trim().length < 2 || d.nomeGestor.trim().length < 2) throw new Error('Informe os nomes da academia e do gestor.')
  return comTransacao(db, async (c) => {
    const academiaId = (
      await c.query(`insert into academia (nome, fuso) values ($1, $2) returning id`, [d.nomeAcademia.trim(), d.fuso ?? 'America/Sao_Paulo'])
    ).rows[0].id as string
    const gestorId = (
      await c.query(`insert into usuario (academia_id, nome, email, papel) values ($1,$2,$3,'gestor') returning id`, [academiaId, d.nomeGestor.trim(), email])
    ).rows[0].id as string
    await criarCategoriasPadrao(c, academiaId)
    return { academiaId, gestorId }
  })
}

const executadoDireto = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (executadoDireto) {
  const { DATABASE_URL, ACADEMIA_NOME, GESTOR_NOME, GESTOR_EMAIL, ACADEMIA_FUSO } = process.env
  if (!DATABASE_URL || !ACADEMIA_NOME || !GESTOR_NOME || !GESTOR_EMAIL) {
    console.error('Defina DATABASE_URL, ACADEMIA_NOME, GESTOR_NOME e GESTOR_EMAIL.')
    process.exit(1)
  }
  const db = criarPool(DATABASE_URL, 1)
  try {
    const r = await criarAcademia(db, { nomeAcademia: ACADEMIA_NOME, nomeGestor: GESTOR_NOME, emailGestor: GESTOR_EMAIL, fuso: ACADEMIA_FUSO })
    console.log(`Academia criada (${r.academiaId}). O gestor deve usar "Esqueci minha senha" para definir a senha.`)
  } catch (e) {
    console.error((e as Error).message)
    process.exitCode = 1
  }
  await db.end()
}
