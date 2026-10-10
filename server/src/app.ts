import { existsSync } from 'node:fs'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import { COOKIE, lerSessao } from './auth/sessao.js'
import type { Config } from './config.js'
import type { Db } from './db/pool.js'
import type { Mailer } from './email.js'
import { ErroApi, semPermissao } from './erros.js'
import { rotasAlunos } from './rotas/alunos.js'
import { rotasAuth } from './rotas/auth.js'
import { rotasFinanceiro } from './rotas/financeiro.js'
import { rotasPlanos } from './rotas/planos.js'
import { rotasPresenca } from './rotas/presenca.js'
import { rotasTurmas } from './rotas/turmas.js'

export interface Deps {
  db: Db
  config: Config
  mailer: Mailer
  /** Relógio injetável para os testes. */
  agora?: () => Date
}

export type Contexto = Required<Deps>

const METODOS_QUE_ESCREVEM = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export async function construirApp(deps: Deps) {
  const ctx: Contexto = { agora: () => new Date(), ...deps }
  const { config } = ctx

  const app = Fastify({
    logger: config.ambiente === 'test' ? false : { redact: ['req.headers.cookie', 'req.headers.authorization'] },
    trustProxy: true, // atrás do proxy da Railway; sem isso o IP do rate limit seria sempre o do proxy
    bodyLimit: 256 * 1024,
  })

  await app.register(cookie)
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => new ErroApi(429, 'muitas_tentativas', 'Muitas tentativas. Aguarde um minuto e tente de novo.'),
  })

  app.decorateRequest('sessao', null)

  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return
    // Defesa em profundidade além do SameSite=Strict: escrita vinda de outra origem é recusada.
    const origem = req.headers.origin
    if (origem && METODOS_QUE_ESCREVEM.has(req.method)) {
      let hostOrigem = ''
      try {
        hostOrigem = new URL(origem).host
      } catch {
        // origem malformada cai no bloqueio abaixo
      }
      if (hostOrigem !== req.headers.host) throw semPermissao()
    }
    req.sessao = await lerSessao(ctx.db, req.cookies[COOKIE])
  })

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    if (err instanceof ErroApi) {
      return reply.status(err.status).send({ erro: { codigo: err.codigo, mensagem: err.message, campos: err.campos } })
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send({ erro: { codigo: err.code ?? 'requisicao_invalida', mensagem: 'Requisição inválida.' } })
    }
    req.log.error(err)
    return reply.status(500).send({ erro: { codigo: 'erro_interno', mensagem: 'Algo deu errado. Tente de novo em instantes.' } })
  })

  app.get('/saude', async () => {
    await ctx.db.query('select 1')
    return { ok: true }
  })

  await app.register(
    async (api) => {
      await rotasAuth(api, ctx)
      await rotasPlanos(api, ctx)
      await rotasAlunos(api, ctx)
      await rotasTurmas(api, ctx)
      await rotasPresenca(api, ctx)
      await rotasFinanceiro(api, ctx)
    },
    { prefix: '/api/v1' },
  )

  const servirFront = !!config.webDist && existsSync(config.webDist)
  if (servirFront) {
    await app.register(fastifyStatic, { root: config.webDist!, wildcard: false })
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || !servirFront) {
      return reply.status(404).send({ erro: { codigo: 'nao_encontrado', mensagem: 'Rota não encontrada.' } })
    }
    return reply.sendFile('index.html')
  })

  return app
}
