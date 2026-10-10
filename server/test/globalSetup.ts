import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'

function portaLivre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number }
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

let pg: EmbeddedPostgres | undefined
let dir: string | undefined

export async function setup() {
  if (process.env.TEST_DATABASE_URL) return
  dir = mkdtempSync(join(tmpdir(), 'redshield-pg-'))
  const port = await portaLivre()
  pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    // No Windows o padrão seria WIN1252 (quebra o schema). Com acento no caminho do projeto o initdb falha em UTF8,
    // então só nesse caso local cai em SQL_ASCII (o servidor não converte nem valida bytes).
    initdbFlags: ['--encoding=' + (/^[\x00-\x7f]*$/.test(process.cwd()) ? 'UTF8' : 'SQL_ASCII'), '--locale=C'],
    onLog: () => {},
    onError: () => {},
  })
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('redshield_test')
  process.env.TEST_DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${port}/redshield_test`
}

export async function teardown() {
  await pg?.stop()
  if (dir) rmSync(dir, { recursive: true, force: true })
}
