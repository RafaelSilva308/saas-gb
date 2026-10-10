import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { criarPool, type Db } from './pool.js'

const RAIZ_DB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db')

interface Migracao {
  nome: string
  sql: string
  /** O schema.sql inicial já traz begin/commit; as demais são envolvidas aqui. */
  envolver: boolean
}

export function listarMigracoes(): Migracao[] {
  const lista: Migracao[] = [
    { nome: '001_schema', sql: readFileSync(join(RAIZ_DB, 'schema.sql'), 'utf8'), envolver: false },
  ]
  const dir = join(RAIZ_DB, 'migrations')
  for (const arq of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    lista.push({ nome: arq.replace(/\.sql$/, ''), sql: readFileSync(join(dir, arq), 'utf8'), envolver: true })
  }
  return lista
}

/** Aplica as migrações pendentes, em ordem. Seguro rodar mais de uma vez e em paralelo. */
export async function migrar(db: Db): Promise<string[]> {
  const c = await db.connect()
  const aplicadas: string[] = []
  try {
    await c.query('select pg_advisory_lock(727001)')
    await c.query(
      'create table if not exists schema_migracao (nome text primary key, aplicada_em timestamptz not null default now())',
    )
    const feitas = new Set((await c.query<{ nome: string }>('select nome from schema_migracao')).rows.map((r) => r.nome))
    for (const m of listarMigracoes()) {
      if (feitas.has(m.nome)) continue
      try {
        await c.query(m.envolver ? `begin;\n${m.sql}\ncommit;` : m.sql)
        await c.query('insert into schema_migracao (nome) values ($1)', [m.nome])
      } catch (e) {
        await c.query('rollback').catch(() => {})
        throw new Error(`Falha na migração ${m.nome}: ${(e as Error).message}`)
      }
      aplicadas.push(m.nome)
    }
  } finally {
    await c.query('select pg_advisory_unlock(727001)').catch(() => {})
    c.release()
  }
  return aplicadas
}

const executadoDireto = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (executadoDireto) {
  const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error('Defina MIGRATION_DATABASE_URL (papel com permissão de DDL) ou DATABASE_URL.')
    process.exit(1)
  }
  const db = criarPool(url, 1)
  migrar(db)
    .then((a) => console.log(a.length ? `Migrações aplicadas: ${a.join(', ')}` : 'Banco já está atualizado.'))
    .catch((e) => {
      console.error(e.message)
      process.exitCode = 1
    })
    .finally(() => db.end())
}
