import pg from 'pg'

// `date` vira 'YYYY-MM-DD' (e não um Date em fuso local): evita virar o dia por conta do fuso.
pg.types.setTypeParser(1082, (v) => v)
// bigint (ex.: id de auditoria) vira number; os valores aqui nunca passam de 2^53.
pg.types.setTypeParser(20, (v) => Number(v))

export type Db = pg.Pool
export type Executor = pg.Pool | pg.PoolClient

export function criarPool(connectionString: string, max = 10): Db {
  return new pg.Pool({ connectionString, max })
}

export async function comTransacao<T>(db: Db, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await db.connect()
  try {
    await c.query('begin')
    const r = await fn(c)
    await c.query('commit')
    return r
  } catch (e) {
    await c.query('rollback').catch(() => {})
    throw e
  } finally {
    c.release()
  }
}
