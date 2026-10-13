import type { FastifyInstance } from 'fastify'
import type { Config } from '../src/config.js'
import { construirApp } from '../src/app.js'
import { migrar } from '../src/db/migrar.js'
import { criarPool, type Db } from '../src/db/pool.js'
import { SENHA_DEMO, semear, type ResultadoSeed } from '../src/db/seed.js'
import type { Mailer } from '../src/email.js'

/** Quarta-feira, 12h em São Paulo. Há aulas às quartas para a turma Fundamentos (Pedro). */
export const AGORA = new Date('2026-03-11T15:00:00Z')
export const HOJE = '2026-03-11'
export { SENHA_DEMO }

export interface Ambiente {
  db: Db
  app: FastifyInstance
  emails: { para: string; assunto: string; texto: string }[]
  relogio: { agora: Date }
  fechar(): Promise<void>
}

export async function criarAmbiente(limiteLogin = 1000): Promise<Ambiente> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error('TEST_DATABASE_URL não definida (globalSetup).')
  const db = criarPool(url, 5)
  await migrar(db)
  const emails: Ambiente['emails'] = []
  const mailer: Mailer = { enviar: async (m) => void emails.push(m) }
  const config: Config = {
    ambiente: 'test',
    databaseUrl: url,
    porta: 0,
    host: '127.0.0.1',
    webDist: undefined,
    sessaoDias: 14,
    cookieSeguro: false,
    urlPublica: 'http://localhost:3000',
    limiteLogin,
    resendApiKey: undefined,
    emailRemetente: 'REDSHIELD <teste@redshield.test>',
    rotinasAtivas: false,
    horaDosAvisos: 8,
    migrarNoInicio: true,
  }
  const relogio = { agora: AGORA }
  const app = await construirApp({ db, config, mailer, agora: () => relogio.agora })
  await app.ready()
  return {
    db,
    app,
    emails,
    relogio,
    fechar: async () => {
      await app.close()
      await db.end()
    },
  }
}

let contador = 0
/** Academia de demonstração isolada: e-mails únicos globalmente (`@t<N>.test`). */
export async function novaAcademia(amb: Ambiente): Promise<ResultadoSeed & { sufixo: string }> {
  const sufixo = `t${++contador}-${Date.now()}.test`
  const r = await semear(amb.db, HOJE, sufixo)
  return { ...r, sufixo }
}

export async function entrar(amb: Ambiente, email: string, senha = SENHA_DEMO): Promise<string> {
  const r = await amb.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, senha } })
  if (r.statusCode !== 200) throw new Error(`login falhou (${r.statusCode}): ${r.body}`)
  return `rs.sid=${r.cookies.find((c) => c.name === 'rs.sid')!.value}`
}

export function chamar(amb: Ambiente, cookie: string | undefined, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown) {
  return amb.app.inject({
    method,
    url: `/api/v1${url}`,
    headers: cookie ? { cookie } : {},
    ...(payload === undefined ? {} : { payload: payload as object }),
  })
}
