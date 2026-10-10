import { construirApp } from './app.js'
import { lerConfig } from './config.js'
import { migrar } from './db/migrar.js'
import { criarPool } from './db/pool.js'
import { mailerConsole } from './email.js'

const config = lerConfig()
const db = criarPool(config.databaseUrl)

const aplicadas = await migrar(db)
if (aplicadas.length) console.log(`Migrações aplicadas: ${aplicadas.join(', ')}`)

const app = await construirApp({ db, config, mailer: mailerConsole })

const encerrar = async () => {
  await app.close()
  await db.end()
  process.exit(0)
}
process.on('SIGTERM', encerrar)
process.on('SIGINT', encerrar)

await app.listen({ port: config.porta, host: config.host })
