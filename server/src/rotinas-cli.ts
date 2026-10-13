import { lerConfig } from './config.js'
import { criarPool } from './db/pool.js'
import { mailerConsole, mailerResend } from './email.js'
import { executarRotinas } from './rotinas.js'

// Execução única das rotinas (cron externo da Railway, por exemplo). Ignora a hora mínima: quem agenda escolhe o horário.
const config = lerConfig()
const db = criarPool(config.databaseUrl, 2)
const mailer = config.resendApiKey ? mailerResend(config.resendApiKey, config.emailRemetente) : mailerConsole
const r = await executarRotinas({ db, config, mailer, agora: () => new Date() }, { forcar: true })
console.log(JSON.stringify(r))
await db.end()
if (r.falhas) process.exitCode = 1
