import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Contexto } from '../app.js'
import { confereSenha, gastaTempoComoSeConferisse, hashSenha, hashToken, novoToken, SENHA_MINIMA } from '../auth/senha.js'
import { COOKIE, exigir, sessaoDe } from '../auth/sessao.js'
import { comTransacao } from '../db/pool.js'
import { ErroApi, naoAutenticado } from '../erros.js'
import { validar } from '../validacao.js'

const email = z.string().trim().toLowerCase().pipe(z.string().email('E-mail inválido.').max(200))
const senhaNova = z.string().min(SENHA_MINIMA, `A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`).max(200)

const credenciais = z.object({ email, senha: z.string().min(1).max(200) })
const pedidoRecuperacao = z.object({ email })
const redefinicao = z.object({ token: z.string().min(10).max(200), senha: senhaNova })
const troca = z.object({ senhaAtual: z.string().min(1).max(200), novaSenha: senhaNova })

export async function rotasAuth(app: FastifyInstance, ctx: Contexto) {
  const { db, config, mailer } = ctx
  const limite = () => ({ rateLimit: { max: config.limiteLogin, timeWindow: '1 minute', hook: 'preHandler' as const } })

  const usuarioDto = (u: { id: string; nome: string; email: string; papel: string; aluno_id: string | null }) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    alunoId: u.aluno_id ?? undefined,
  })

  app.post('/auth/login', { config: limite() }, async (req, reply) => {
    const { email: mail, senha } = validar(credenciais, req.body)
    const { rows } = await db.query(
      'select id, nome, email, papel, aluno_id, senha_hash from usuario where lower(email) = $1 and ativo',
      [mail],
    )
    const u = rows[0]
    const confere = u?.senha_hash ? await confereSenha(u.senha_hash, senha) : await gastaTempoComoSeConferisse(senha)
    if (!u || !confere) throw new ErroApi(401, 'credenciais_invalidas', 'E-mail ou senha incorretos.')

    const { token, hash } = novoToken()
    await db.query('delete from sessao where expira_em < now()')
    await db.query(
      `insert into sessao (token_hash, usuario_id, expira_em, ip, user_agent)
       values ($1, $2, now() + make_interval(days => $3), $4, $5)`,
      [hash, u.id, config.sessaoDias, req.ip, req.headers['user-agent']?.slice(0, 300) ?? null],
    )
    await db.query('update usuario set ultimo_acesso = now() where id = $1', [u.id])

    reply.setCookie(COOKIE, token, {
      httpOnly: true,
      secure: config.cookieSeguro,
      sameSite: 'strict',
      path: '/',
      maxAge: config.sessaoDias * 86400,
    })
    return { usuario: usuarioDto(u) }
  })

  app.post('/auth/logout', async (req, reply) => {
    const token = req.cookies[COOKIE]
    if (token) await db.query('delete from sessao where token_hash = $1', [hashToken(token)])
    reply.clearCookie(COOKIE, { path: '/' })
    return reply.status(204).send()
  })

  app.get('/auth/eu', { preHandler: exigir() }, async (req) => {
    const s = sessaoDe(req)
    const { rows } = await db.query('select nome from academia where id = $1', [s.academiaId])
    return {
      usuario: usuarioDto({ id: s.usuarioId, nome: s.nome, email: s.email, papel: s.papel, aluno_id: s.alunoId }),
      academia: rows[0]?.nome as string,
    }
  })

  // Resposta idêntica exista ou não a conta: não revela quem é cliente.
  app.post('/auth/esqueci-senha', { config: limite() }, async (req, reply) => {
    const { email: mail } = validar(pedidoRecuperacao, req.body)
    const { rows } = await db.query('select id, nome, email from usuario where lower(email) = $1 and ativo', [mail])
    const u = rows[0]
    if (u) {
      const { token, hash } = novoToken()
      await comTransacao(db, async (c) => {
        await c.query(
          `update token_senha set usado_em = now() where usuario_id = $1 and finalidade = 'recuperar_senha' and usado_em is null`,
          [u.id],
        )
        await c.query(
          `insert into token_senha (token_hash, usuario_id, finalidade, expira_em)
           values ($1, $2, 'recuperar_senha', now() + interval '1 hour')`,
          [hash, u.id],
        )
      })
      await mailer
        .enviar({
          para: u.email,
          assunto: 'REDSHIELD · redefinir sua senha',
          texto: `Olá, ${u.nome}.\n\nPara criar uma nova senha, abra o link (vale por 1 hora):\n${config.urlPublica}/#/redefinir-senha?token=${token}\n\nSe não foi você, ignore esta mensagem.`,
        })
        .catch((e) => req.log.error(e))
    }
    return reply.status(202).send({ ok: true })
  })

  // Serve para recuperação e também para o aluno convidado criar a primeira senha.
  app.post('/auth/redefinir-senha', { config: limite() }, async (req, reply) => {
    const { token, senha } = validar(redefinicao, req.body)
    const hash = await hashSenha(senha)
    await comTransacao(db, async (c) => {
      const { rows } = await c.query(
        `update token_senha set usado_em = now()
          where token_hash = $1 and usado_em is null and expira_em > now()
          returning usuario_id`,
        [hashToken(token)],
      )
      if (!rows[0]) throw new ErroApi(400, 'token_invalido', 'Link inválido ou vencido. Peça um novo.')
      await c.query('update usuario set senha_hash = $2 where id = $1', [rows[0].usuario_id, hash])
      await c.query('delete from sessao where usuario_id = $1', [rows[0].usuario_id])
    })
    return reply.status(204).send()
  })

  app.post('/auth/trocar-senha', { preHandler: exigir(), config: limite() }, async (req, reply) => {
    const s = sessaoDe(req)
    const { senhaAtual, novaSenha } = validar(troca, req.body)
    const { rows } = await db.query('select senha_hash from usuario where id = $1', [s.usuarioId])
    if (!rows[0]?.senha_hash || !(await confereSenha(rows[0].senha_hash, senhaAtual))) {
      throw new ErroApi(401, 'credenciais_invalidas', 'A senha atual está incorreta.')
    }
    const atual = req.cookies[COOKIE]
    if (!atual) throw naoAutenticado()
    await db.query('update usuario set senha_hash = $2 where id = $1', [s.usuarioId, await hashSenha(novaSenha)])
    await db.query('delete from sessao where usuario_id = $1 and token_hash <> $2', [s.usuarioId, hashToken(atual)])
    return reply.status(204).send()
  })
}
