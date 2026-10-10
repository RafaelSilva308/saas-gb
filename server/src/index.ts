import { construirApp, type Contexto } from './app.js'
import { lerConfig } from './config.js'
import { migrar } from './db/migrar.js'
import { criarPool } from './db/pool.js'
import { mailerConsole, mailerResend } from './email.js'
import { iniciarAgendador } from './rotinas.js'

const config = lerConfig()
const db = criarPool(config.databaseUrl)

if (config.migrarNoInicio) {
  const aplicadas = await migrar(db)
  if (aplicadas.length) console.log(`Migrações aplicadas: ${aplicadas.join(', ')}`)
}

const mailer = config.resendApiKey ? mailerResend(config.resendApiKey, config.emailRemetente) : mailerConsole
if (config.ambiente === 'production' && !config.resendApiKey) console.warn('RESEND_API_KEY ausente: e-mails só serão escritos no log.')

const app = await construirApp({ db, config, mailer })

let pararRotinas = () => {}
if (config.rotinasAtivas) {
  const ctx: Contexto = { db, config, mailer, agora: () => new Date() }
  pararRotinas = iniciarAgendador(ctx)
}

const encerrar = async () => {
  pararRotinas()
  await app.close()
  await db.end()
  process.exit(0)
}
process.on('SIGTERM', encerrar)
process.on('SIGINT', encerrar)

await app.listen({ port: config.porta, host: config.host })
