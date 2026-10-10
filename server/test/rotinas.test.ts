import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Contexto } from '../src/app.js'
import { lerConfig } from '../src/config.js'
import { mailerResend, type Mailer } from '../src/email.js'
import { executarRotinas } from '../src/rotinas.js'
import { AGORA, chamar, criarAmbiente, entrar, novaAcademia, type Ambiente } from './ajuda.js'

let amb: Ambiente
let A: Awaited<ReturnType<typeof novaAcademia>>
let B: Awaited<ReturnType<typeof novaAcademia>>
let gestorA: string
let gestorB: string
let profA: string
const enviados: { para: string; assunto: string; texto: string }[] = []
let falhar = false

const mailer: Mailer = {
  async enviar(m) {
    if (falhar) throw new Error('provedor fora do ar')
    enviados.push(m)
    return `msg-${enviados.length}`
  },
}

let agora = AGORA
const ctx = (): Contexto => ({
  db: amb.db,
  config: lerConfig({ DATABASE_URL: process.env.TEST_DATABASE_URL, NODE_ENV: 'test' }),
  mailer,
  agora: () => agora,
})

beforeAll(async () => {
  amb = await criarAmbiente()
  A = await novaAcademia(amb)
  B = await novaAcademia(amb)
  gestorA = await entrar(amb, `gestor@${A.sufixo}`)
  gestorB = await entrar(amb, `gestor@${B.sufixo}`)
  profA = await entrar(amb, `professor@${A.sufixo}`)
})
afterAll(() => amb.fechar())

const rodar = (academiaId: string, forcar = true) => executarRotinas(ctx(), { academiaId, forcar })

describe('configuração dos avisos', () => {
  it('só o gestor mexe; sem configuração tudo começa desligado', async () => {
    expect((await chamar(amb, profA, 'GET', '/avisos')).statusCode).toBe(403)
    expect((await chamar(amb, profA, 'PUT', '/avisos/vencimento', { ativo: true })).statusCode).toBe(403)
    const lista = (await chamar(amb, gestorB, 'GET', '/avisos')).json().itens as { tipo: string; ativo: boolean }[]
    expect(lista.map((i) => i.tipo)).toEqual(['vencimento', 'inadimplencia', 'aniversario', 'ausencia', 'resumo_semanal'])
    expect((await chamar(amb, gestorB, 'PUT', '/avisos/nada', { ativo: true })).statusCode).toBe(400)
  })

  it('liga e desliga, auditado e isolado por academia', async () => {
    expect((await chamar(amb, gestorA, 'PUT', '/avisos/vencimento', { ativo: true })).json()).toEqual({ tipo: 'vencimento', ativo: true })
    const a = (await chamar(amb, gestorA, 'GET', '/avisos')).json().itens.find((i: any) => i.tipo === 'vencimento')
    const b = (await chamar(amb, gestorB, 'GET', '/avisos')).json().itens.find((i: any) => i.tipo === 'vencimento')
    expect([a.ativo, b.ativo]).toEqual([true, false])
    const log = await amb.db.query(`select acao from log_auditoria where academia_id = $1 and acao = 'aviso.configurar'`, [A.academiaId])
    expect(log.rowCount).toBe(1)
  })
})

describe('dados da academia', () => {
  it('lê, edita e valida o fuso', async () => {
    expect((await chamar(amb, profA, 'GET', '/academia')).statusCode).toBe(200)
    expect((await chamar(amb, profA, 'PATCH', '/academia', { nome: 'X Y' })).statusCode).toBe(403)
    const r = await chamar(amb, gestorA, 'PATCH', '/academia', { telefone: '(11) 99999-0000', endereco: '  ' })
    expect(r.json()).toMatchObject({ telefone: '(11) 99999-0000', endereco: null, fuso: 'America/Sao_Paulo' })
    expect((await chamar(amb, gestorA, 'PATCH', '/academia', { fuso: 'Marte/Olympus' })).statusCode).toBe(422)
  })
})

describe('rotinas de e-mail', () => {
  let alvo: { id: string; email: string }

  it('gera as cobranças do mês e não envia nada com os avisos desligados', async () => {
    const r = await rodar(B.academiaId)
    expect(r.cobrancasGeradas).toBeGreaterThan(0)
    expect(r.enviados).toBe(0)
    expect(enviados.filter((e) => e.para.endsWith(B.sufixo))).toHaveLength(0)
  })

  it('aviso de vencimento sai uma única vez, mesmo rodando duas vezes', async () => {
    await rodar(A.academiaId)
    alvo = (await amb.db.query(`select id, email from aluno where academia_id = $1 and status = 'ativo' and email is not null limit 1`, [A.academiaId])).rows[0]
    expect(alvo).toBeTruthy()
    await amb.db.query(`update cobranca set vencimento = '2026-03-14' where aluno_id = $1 and competencia = '2026-03-01' and status = 'aberta'`, [alvo.id])

    const r1 = await rodar(A.academiaId)
    expect(r1.enviados).toBeGreaterThanOrEqual(1)
    const meus = () => enviados.filter((e) => e.para === alvo.email)
    expect(meus()).toHaveLength(1)
    expect(meus()[0]!.assunto).toContain('14/03/2026')

    const r2 = await rodar(A.academiaId)
    expect(r2.enviados).toBe(0)
    expect(r2.jaEnviados).toBeGreaterThanOrEqual(1)
    expect(meus()).toHaveLength(1)

    const reg = await amb.db.query(`select status, provedor_id from envio_email where aluno_id = $1 and tipo = 'vencimento'`, [alvo.id])
    expect(reg.rows).toHaveLength(1)
    expect(reg.rows[0].status).toBe('enviado')
    expect(reg.rows[0].provedor_id).toMatch(/^msg-/)
  })

  it('falha do provedor fica registrada como "falhou" e não derruba as rotinas', async () => {
    await chamar(amb, gestorA, 'PUT', '/avisos/inadimplencia', { ativo: true })
    await amb.db.query(`update cobranca set vencimento = '2026-03-05' where aluno_id = $1 and competencia = '2026-03-01' and status = 'aberta'`, [alvo.id])
    falhar = true
    try {
      const r = await rodar(A.academiaId)
      expect(r.falhas).toBeGreaterThanOrEqual(1)
    } finally {
      falhar = false
    }
    const reg = await amb.db.query(`select status, erro from envio_email where aluno_id = $1 and tipo = 'inadimplencia'`, [alvo.id])
    expect(reg.rows[0]).toMatchObject({ status: 'falhou', erro: 'provedor fora do ar' })
    const lista = (await chamar(amb, gestorA, 'GET', '/avisos/envios')).json().itens as { status: string }[]
    expect(lista.some((e) => e.status === 'falhou')).toBe(true)
  })

  it('respeita a hora mínima no fuso da academia (7h em São Paulo ainda não envia)', async () => {
    const antes = enviados.length
    agora = new Date('2026-03-12T10:00:00Z') // 07h de 12/03 em São Paulo
    try {
      const r = await rodar(A.academiaId, false)
      expect(r).toMatchObject({ cobrancasGeradas: 0, enviados: 0, falhas: 0 })
      expect(enviados.length).toBe(antes)
    } finally {
      agora = AGORA
    }
  })

  it('rota manual só mexe na própria academia', async () => {
    const r = await chamar(amb, gestorA, 'POST', '/rotinas/executar')
    expect(r.statusCode).toBe(200)
    expect(r.json().academias).toBe(1)
    expect((await chamar(amb, profA, 'POST', '/rotinas/executar')).statusCode).toBe(403)
  })
})

describe('mailer Resend', () => {
  const corpo = { para: 'a@b.test', assunto: 'Oi', texto: 'Texto' }

  it('envia com a chave no cabeçalho e devolve o id do provedor', async () => {
    let chamada: { url: string; init: RequestInit } | undefined
    const buscar = (async (url: string, init: RequestInit) => {
      chamada = { url, init }
      return new Response(JSON.stringify({ id: 'abc123' }), { status: 200 })
    }) as unknown as typeof fetch
    const id = await mailerResend('re_chave', 'REDSHIELD <x@y.test>', buscar).enviar(corpo)
    expect(id).toBe('abc123')
    expect(chamada!.url).toBe('https://api.resend.com/emails')
    expect((chamada!.init.headers as Record<string, string>).authorization).toBe('Bearer re_chave')
    expect(JSON.parse(chamada!.init.body as string)).toMatchObject({ from: 'REDSHIELD <x@y.test>', to: ['a@b.test'], subject: 'Oi' })
  })

  it('lança erro quando o provedor recusa', async () => {
    const buscar = (async () => new Response('chave inválida', { status: 401 })) as unknown as typeof fetch
    await expect(mailerResend('x', 'y', buscar).enviar(corpo)).rejects.toThrow(/401/)
  })
})

describe('nova academia (produção)', () => {
  it('cria academia, categorias padrão e gestor sem senha; o gestor define a senha por e-mail', async () => {
    const { criarAcademia } = await import('../src/db/nova-academia.js')
    const email = `dono@nova-${Date.now()}.test`
    const r = await criarAcademia(amb.db, { nomeAcademia: 'Academia Nova', nomeGestor: 'Dono Novo', emailGestor: email.toUpperCase() })
    const u = (await amb.db.query('select email, papel, senha_hash from usuario where id = $1', [r.gestorId])).rows[0]
    expect(u).toEqual({ email, papel: 'gestor', senha_hash: null })
    expect((await amb.db.query('select count(*)::int as n from categoria_financeira where academia_id = $1', [r.academiaId])).rows[0].n).toBeGreaterThan(5)
    expect((await amb.db.query('select count(*)::int as n from aluno where academia_id = $1', [r.academiaId])).rows[0].n).toBe(0)

    const antes = amb.emails.length
    expect((await chamar(amb, undefined, 'POST', '/auth/esqueci-senha', { email })).statusCode).toBeLessThan(300)
    expect(amb.emails.length).toBe(antes + 1)
    await expect(criarAcademia(amb.db, { nomeAcademia: 'X', nomeGestor: 'Y', emailGestor: 'invalido' })).rejects.toThrow()
  })
})
