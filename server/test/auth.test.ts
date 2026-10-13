import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chamar, criarAmbiente, entrar, novaAcademia, SENHA_DEMO, type Ambiente } from './ajuda.js'

let amb: Ambiente
let s: string

beforeAll(async () => {
  amb = await criarAmbiente()
  s = (await novaAcademia(amb)).sufixo
})
afterAll(() => amb.fechar())

describe('autenticação', () => {
  it('entra com senha correta e devolve o usuário; /auth/eu usa o cookie', async () => {
    const r = await chamar(amb, undefined, 'POST', '/auth/login', { email: `Gestor@${s}`, senha: SENHA_DEMO })
    expect(r.statusCode).toBe(200)
    expect(r.json().usuario).toMatchObject({ papel: 'gestor', email: `gestor@${s}` })
    const cookie = r.cookies.find((c) => c.name === 'rs.sid')!
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.sameSite).toBe('Strict')

    const eu = await chamar(amb, `rs.sid=${cookie.value}`, 'GET', '/auth/eu')
    expect(eu.statusCode).toBe(200)
    expect(eu.json().academia).toBe('REDSHIELD')
  })

  it('recusa senha errada e e-mail inexistente com a mesma mensagem', async () => {
    const a = await chamar(amb, undefined, 'POST', '/auth/login', { email: `gestor@${s}`, senha: 'errada123' })
    const b = await chamar(amb, undefined, 'POST', '/auth/login', { email: `ninguem@${s}`, senha: 'errada123' })
    expect(a.statusCode).toBe(401)
    expect(b.statusCode).toBe(401)
    expect(a.json()).toEqual(b.json())
  })

  it('exige sessão nas rotas protegidas', async () => {
    expect((await chamar(amb, undefined, 'GET', '/alunos')).statusCode).toBe(401)
    expect((await chamar(amb, 'rs.sid=lixo', 'GET', '/auth/eu')).statusCode).toBe(401)
  })

  it('logout invalida a sessão no servidor', async () => {
    const cookie = await entrar(amb, `professor@${s}`)
    expect((await chamar(amb, cookie, 'GET', '/auth/eu')).statusCode).toBe(200)
    expect((await chamar(amb, cookie, 'POST', '/auth/logout')).statusCode).toBe(204)
    expect((await chamar(amb, cookie, 'GET', '/auth/eu')).statusCode).toBe(401)
  })

  it('recusa escrita com Origin de outro site', async () => {
    const r = await amb.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { origin: 'https://malicioso.example', host: 'localhost:3000' },
      payload: { email: `gestor@${s}`, senha: SENHA_DEMO },
    })
    expect(r.statusCode).toBe(403)
  })

  it('guarda só o hash do token da sessão', async () => {
    const cookie = await entrar(amb, `gestor@${s}`)
    const token = cookie.split('=')[1]!
    const { rows } = await amb.db.query('select token_hash from sessao')
    expect(rows.some((r) => r.token_hash.toString('base64url') === token)).toBe(false)
  })
})

describe('recuperação de senha', () => {
  it('resposta é igual para e-mail existente e inexistente', async () => {
    const a = await chamar(amb, undefined, 'POST', '/auth/esqueci-senha', { email: `gestor@${s}` })
    const b = await chamar(amb, undefined, 'POST', '/auth/esqueci-senha', { email: `fantasma@${s}` })
    expect(a.statusCode).toBe(202)
    expect(b.statusCode).toBe(202)
    expect(a.json()).toEqual(b.json())
  })

  it('token redefine a senha uma única vez e derruba as sessões', async () => {
    const email = `professor@${s}`
    const velha = await entrar(amb, email)
    amb.emails.length = 0
    await chamar(amb, undefined, 'POST', '/auth/esqueci-senha', { email })
    const token = /token=([\w-]+)/.exec(amb.emails.at(-1)!.texto)![1]!

    const ok = await chamar(amb, undefined, 'POST', '/auth/redefinir-senha', { token, senha: 'nova-senha-123' })
    expect(ok.statusCode).toBe(204)
    expect((await chamar(amb, velha, 'GET', '/auth/eu')).statusCode).toBe(401)
    expect((await chamar(amb, undefined, 'POST', '/auth/login', { email, senha: SENHA_DEMO })).statusCode).toBe(401)
    expect((await chamar(amb, undefined, 'POST', '/auth/login', { email, senha: 'nova-senha-123' })).statusCode).toBe(200)

    const reuso = await chamar(amb, undefined, 'POST', '/auth/redefinir-senha', { token, senha: 'outra-senha-123' })
    expect(reuso.statusCode).toBe(400)
    expect(reuso.json().erro.codigo).toBe('token_invalido')
  })

  it('exige senha com no mínimo 8 caracteres', async () => {
    const r = await chamar(amb, undefined, 'POST', '/auth/redefinir-senha', { token: 'x'.repeat(20), senha: 'curta' })
    expect(r.statusCode).toBe(400)
    expect(r.json().erro.campos.senha).toBeTruthy()
  })

  it('trocar senha exige a senha atual e mantém só a sessão corrente', async () => {
    const email = `aluno@${s}`
    const atual = await entrar(amb, email)
    const outra = await entrar(amb, email)
    expect((await chamar(amb, atual, 'POST', '/auth/trocar-senha', { senhaAtual: 'errada', novaSenha: 'senha-nova-123' })).statusCode).toBe(401)
    expect((await chamar(amb, atual, 'POST', '/auth/trocar-senha', { senhaAtual: SENHA_DEMO, novaSenha: 'senha-nova-123' })).statusCode).toBe(204)
    expect((await chamar(amb, atual, 'GET', '/auth/eu')).statusCode).toBe(200)
    expect((await chamar(amb, outra, 'GET', '/auth/eu')).statusCode).toBe(401)
  })
})

describe('limite de tentativas', () => {
  it('responde 429 depois de exceder o limite por minuto', async () => {
    const limitado = await criarAmbiente(3)
    try {
      const codigos: number[] = []
      for (let i = 0; i < 5; i++) {
        codigos.push((await chamar(limitado, undefined, 'POST', '/auth/login', { email: 'x@y.com', senha: 'qualquer' })).statusCode)
      }
      expect(codigos).toEqual([401, 401, 401, 429, 429])
    } finally {
      await limitado.fechar()
    }
  })
})
