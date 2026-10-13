import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chamar, criarAmbiente, entrar, novaAcademia, type Ambiente } from './ajuda.js'

let amb: Ambiente
let A: Awaited<ReturnType<typeof novaAcademia>>
let gestorA: string
let profA: string
let alunoA: string

beforeAll(async () => {
  amb = await criarAmbiente()
  A = await novaAcademia(amb)
  gestorA = await entrar(amb, `gestor@${A.sufixo}`)
  profA = await entrar(amb, `professor@${A.sufixo}`)
  alunoA = await entrar(amb, `aluno@${A.sufixo}`)
  await chamar(amb, gestorA, 'POST', '/cobrancas/gerar', { competencia: '2026-03' })
})
afterAll(() => amb.fechar())

const get = async (cookie: string, url: string) => {
  const r = await chamar(amb, cookie, 'GET', url)
  expect(r.statusCode, url).toBe(200)
  return r.json()
}

describe('painel por papel', () => {
  it('aluno vê só os próprios dados: nada de totais da academia nem de outros alunos', async () => {
    const p = await get(alunoA, '/metricas/painel')
    expect(p.papel).toBe('aluno')
    expect(p.aluno.nome).toBe('Pedro Almeida')
    expect(Object.keys(p).sort()).toEqual(['aluno', 'frequencia30d', 'papel', 'presencasTotal', 'proximaAula', 'statusPagamento'])
    expect(JSON.stringify(p)).not.toContain('emRisco')
    expect(p.proximaAula).toMatchObject({ data: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
  })

  it('professor não recebe números financeiros', async () => {
    const p = await get(profA, '/metricas/painel')
    expect(p.papel).toBe('professor')
    expect(p.alunosAtivos).toBeGreaterThan(0)
    expect(p).not.toHaveProperty('mrrCentavos')
    expect(p).not.toHaveProperty('fluxoDoMes')
    expect((await chamar(amb, profA, 'GET', '/metricas/financeiro')).statusCode).toBe(403)
  })

  it('gestor recebe indicadores completos, em centavos', async () => {
    const p = await get(gestorA, '/metricas/painel')
    expect(p.papel).toBe('gestor')
    expect(p.mrrCentavos).toBeGreaterThan(0)
    expect(Number.isInteger(p.mrrCentavos)).toBe(true)
    expect(p.taxaPresenca30d).toBeGreaterThan(0)
    expect(p.taxaPresenca30d).toBeLessThanOrEqual(100)
    expect(p.inadimplentes).toMatchObject({ alunos: expect.any(Number), valorEmAbertoCentavos: expect.any(Number) })
  })

  it('exige login', async () => {
    expect((await chamar(amb, undefined, 'GET', '/metricas/painel')).statusCode).toBe(401)
  })
})

describe('séries', () => {
  it('financeiro devolve um item por mês, inclusive meses sem lançamento', async () => {
    const cats = await chamar(amb, gestorA, 'POST', '/categorias-financeiras', { tipo: 'despesa', nome: 'Luz' })
    await chamar(amb, gestorA, 'POST', '/transacoes', { tipo: 'despesa', categoriaId: cats.json().id, descricao: 'Conta de luz', valorCentavos: 30000, data: '2026-02-10' })
    const f = await get(gestorA, '/metricas/financeiro?meses=3')
    expect(f.itens.map((i: any) => i.mes)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(f.itens[1]).toMatchObject({ despesaCentavos: 30000, resultadoCentavos: -30000 })
    expect(f.itens[0]).toMatchObject({ receitaCentavos: 0, despesaCentavos: 0 })
  })

  it('presença semanal tem o número de semanas pedido e taxas entre 0 e 100', async () => {
    const p = await get(profA, '/metricas/presenca?semanas=4')
    expect(p.itens).toHaveLength(4)
    for (const i of p.itens) {
      expect(i.taxa).toBeGreaterThanOrEqual(0)
      expect(i.taxa).toBeLessThanOrEqual(100)
    }
    expect(p.itens.some((i: any) => i.presencas > 0)).toBe(true)
  })

  it('faixas e ocupação', async () => {
    const f = await get(alunoA, '/metricas/faixas')
    expect(f.total).toBeGreaterThan(0)
    expect(f.itens.reduce((t: number, i: any) => t + i.qtd, 0)).toBe(f.total)
    expect((await chamar(amb, alunoA, 'GET', '/metricas/ocupacao')).statusCode).toBe(403)
    const o = await get(profA, '/metricas/ocupacao')
    expect(o.itens).toHaveLength(5)
  })
})

describe('graduações elegíveis (regra provisória)', () => {
  it('só a equipe vê; aluno com tempo e frequência suficientes aparece com o próximo passo', async () => {
    expect((await chamar(amb, alunoA, 'GET', '/graduacoes/elegiveis')).statusCode).toBe(403)
    const r = await get(profA, '/graduacoes/elegiveis')
    expect(r.regraProvisoria).toMatchObject({ diasMinimos: 90, frequenciaMinima: 70 })
    for (const i of r.itens) {
      expect(i.diasDesdeUltima).toBeGreaterThanOrEqual(90)
      expect(i.frequencia30d).toBeGreaterThanOrEqual(70)
    }
  })
})
