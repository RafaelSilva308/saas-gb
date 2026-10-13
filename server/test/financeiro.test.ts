import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chamar, criarAmbiente, entrar, novaAcademia, type Ambiente } from './ajuda.js'

let amb: Ambiente
let A: Awaited<ReturnType<typeof novaAcademia>>
let B: Awaited<ReturnType<typeof novaAcademia>>
let gestorA: string
let profA: string
let alunoA: string
let gestorB: string

beforeAll(async () => {
  amb = await criarAmbiente()
  A = await novaAcademia(amb)
  B = await novaAcademia(amb)
  gestorA = await entrar(amb, `gestor@${A.sufixo}`)
  profA = await entrar(amb, `professor@${A.sufixo}`)
  alunoA = await entrar(amb, `aluno@${A.sufixo}`)
  gestorB = await entrar(amb, `gestor@${B.sufixo}`)
})
afterAll(() => amb.fechar())

const lista = async (cookie: string, url: string) => (await chamar(amb, cookie, 'GET', url)).json()

describe('cobranças', () => {
  it('só o gestor acessa o financeiro', async () => {
    for (const c of [profA, alunoA]) {
      for (const url of ['/cobrancas', '/inadimplencia', '/transacoes', '/categorias-financeiras']) {
        expect((await chamar(amb, c, 'GET', url)).statusCode, url).toBe(403)
      }
    }
    expect((await chamar(amb, undefined, 'GET', '/cobrancas')).statusCode).toBe(401)
  })

  it('gera as cobranças do mês de forma idempotente, só para alunos ativos com plano', async () => {
    const esperado = (
      await amb.db.query(
        `select count(*)::int as n from aluno a join plano p on p.id = a.plano_id
          where a.academia_id = $1 and a.status = 'ativo' and a.matricula_em <= '2026-03-31'
            and (p.periodicidade = 'mensal' or (extract(year from age('2026-03-01', date_trunc('month', a.matricula_em))) * 12
                 + extract(month from age('2026-03-01', date_trunc('month', a.matricula_em)))) % (case p.periodicidade when 'trimestral' then 3 when 'semestral' then 6 else 12 end) = 0)`,
        [A.academiaId],
      )
    ).rows[0].n as number
    expect(esperado).toBeGreaterThan(0)

    const r1 = await chamar(amb, gestorA, 'POST', '/cobrancas/gerar', { competencia: '2026-03' })
    expect(r1.statusCode).toBe(200)
    expect(r1.json().criadas).toBe(esperado)
    expect((await chamar(amb, gestorA, 'POST', '/cobrancas/gerar', { competencia: '2026-03' })).json().criadas).toBe(0)

    expect((await chamar(amb, gestorA, 'POST', '/cobrancas/gerar', { competencia: '2026-08' })).statusCode).toBe(422)
    expect((await chamar(amb, gestorA, 'POST', '/cobrancas/gerar', { competencia: '2026-3' })).statusCode).toBe(400)
  })

  it('isola academias', async () => {
    expect((await lista(gestorB, '/cobrancas')).total).toBe(0)
    const a = await lista(gestorA, '/cobrancas?competencia=2026-03&limite=200')
    expect(a.total).toBeGreaterThan(0)
    const id = a.itens[0].id
    expect((await chamar(amb, gestorB, 'POST', `/cobrancas/${id}/pagar`, {})).statusCode).toBe(404)
  })

  it('baixa cria a transação, estorno remove; não paga duas vezes', async () => {
    const aberta = (await lista(gestorA, '/cobrancas?competencia=2026-03&limite=200')).itens.find((c: any) => c.valorCentavos > 0)
    const id = aberta.id as string

    const pago = await chamar(amb, gestorA, 'POST', `/cobrancas/${id}/pagar`, { metodo: 'dinheiro' })
    expect(pago.statusCode).toBe(200)
    expect(pago.json()).toMatchObject({ status: 'paga', situacao: 'paga', pagoEm: '2026-03-11' })

    const t = await amb.db.query('select valor_centavos, metodo, data::text as data from transacao where cobranca_id = $1', [id])
    expect(t.rows).toEqual([{ valor_centavos: aberta.valorCentavos, metodo: 'dinheiro', data: '2026-03-11' }])

    const dupla = await chamar(amb, gestorA, 'POST', `/cobrancas/${id}/pagar`, {})
    expect(dupla.statusCode).toBe(409)
    expect(dupla.json().erro.codigo).toBe('cobranca_ja_paga')

    expect((await chamar(amb, gestorA, 'POST', `/cobrancas/${id}/cancelar`)).statusCode).toBe(409)

    const est = await chamar(amb, gestorA, 'POST', `/cobrancas/${id}/estornar`)
    expect(est.statusCode).toBe(200)
    expect(est.json()).toMatchObject({ status: 'aberta', pagoEm: null })
    expect((await amb.db.query('select 1 from transacao where cobranca_id = $1', [id])).rowCount).toBe(0)
    expect((await chamar(amb, gestorA, 'POST', `/cobrancas/${id}/estornar`)).statusCode).toBe(409)

    const log = await amb.db.query(`select acao from log_auditoria where entidade_id = $1 order by criado_em`, [id])
    expect(log.rows.map((l) => l.acao)).toEqual(['cobranca.pagar', 'cobranca.estornar'])
  })

  it('não aceita pagamento com data futura', async () => {
    const id = (await lista(gestorA, '/cobrancas?competencia=2026-03&limite=200')).itens[0].id
    const r = await chamar(amb, gestorA, 'POST', `/cobrancas/${id}/pagar`, { data: '2026-03-12' })
    expect(r.statusCode).toBe(422)
  })

  it('cobrança vencida vira atrasada e aparece na inadimplência; status do aluno reage', async () => {
    const alvo = (await lista(gestorA, '/cobrancas?competencia=2026-03&limite=200')).itens[0]
    await amb.db.query(`update cobranca set vencimento = '2026-03-01' where id = $1`, [alvo.id])

    const c = (await lista(gestorA, `/alunos/${alvo.alunoId}/cobrancas`)).itens.find((x: any) => x.id === alvo.id)
    expect(c).toMatchObject({ situacao: 'atrasada', diasAtraso: 10 })

    const atrasadas = await lista(gestorA, '/cobrancas?status=atrasada&limite=200')
    expect(atrasadas.itens.map((x: any) => x.id)).toContain(alvo.id)

    const inad = await lista(gestorA, '/inadimplencia')
    const item = inad.itens.find((i: any) => i.alunoId === alvo.alunoId)
    expect(item).toMatchObject({ cobrancas: 1, totalCentavos: alvo.valorCentavos, diasAtraso: 10 })

    expect((await lista(gestorA, `/alunos/${alvo.alunoId}`)).statusPagamento).toBe('atrasado')

    const c2 = await chamar(amb, gestorA, 'POST', `/cobrancas/${alvo.id}/cancelar`)
    expect(c2.json()).toMatchObject({ status: 'cancelada' })
    expect((await lista(gestorA, `/alunos/${alvo.alunoId}`)).statusPagamento).not.toBe('atrasado')
    expect((await chamar(amb, gestorA, 'POST', `/cobrancas/${alvo.id}/pagar`, {})).statusCode).toBe(409)
  })

  it('o dia de hoje respeita o fuso da academia (21h em Brasília ainda é o mesmo dia)', async () => {
    const antes = amb.relogio.agora
    try {
      amb.relogio.agora = new Date('2026-03-12T01:30:00Z') // 22h30 de 11/03 em São Paulo
      const id = (await lista(gestorA, '/cobrancas?competencia=2026-03&limite=200')).itens.find((c: any) => c.status === 'aberta').id
      const r = await chamar(amb, gestorA, 'POST', `/cobrancas/${id}/pagar`, {})
      expect(r.json().pagoEm).toBe('2026-03-11')
    } finally {
      amb.relogio.agora = antes
    }
  })
})

describe('transações e categorias', () => {
  it('cria, edita e remove lançamentos; resumo soma receitas e despesas', async () => {
    const despesa = await chamar(amb, gestorA, 'POST', '/categorias-financeiras', { tipo: 'despesa', nome: 'Aluguel' })
    expect(despesa.statusCode).toBe(201)
    expect((await chamar(amb, gestorA, 'POST', '/categorias-financeiras', { tipo: 'despesa', nome: 'Aluguel' })).json().erro.codigo).toBe('categoria_duplicada')

    const novo = await chamar(amb, gestorA, 'POST', '/transacoes', {
      tipo: 'despesa', categoriaId: despesa.json().id, descricao: 'Aluguel de março', valorCentavos: 250000, data: '2026-03-05',
    })
    expect(novo.statusCode).toBe(201)
    expect(novo.json()).toMatchObject({ valorCentavos: 250000, metodo: 'pix', categoria: 'Aluguel' })

    const mesTx = await lista(gestorA, '/transacoes?mes=2026-03&tipo=despesa')
    expect(mesTx.resumo).toMatchObject({ despesaCentavos: 250000, receitaCentavos: 0, saldoCentavos: -250000 })

    const ed = await chamar(amb, gestorA, 'PATCH', `/transacoes/${novo.json().id}`, { valorCentavos: 260000, conciliada: true })
    expect(ed.json()).toMatchObject({ valorCentavos: 260000, conciliada: true })

    // categoria de tipo errado e valor inválido
    const rec = await chamar(amb, gestorA, 'POST', '/categorias-financeiras', { tipo: 'receita', nome: 'Eventos' })
    expect((await chamar(amb, gestorA, 'POST', '/transacoes', { tipo: 'despesa', categoriaId: rec.json().id, descricao: 'X Y', valorCentavos: 100, data: '2026-03-05' })).statusCode).toBe(422)
    expect((await chamar(amb, gestorA, 'POST', '/transacoes', { tipo: 'despesa', categoriaId: despesa.json().id, descricao: 'X Y', valorCentavos: 0, data: '2026-03-05' })).statusCode).toBe(400)
    expect((await chamar(amb, gestorA, 'POST', '/transacoes', { tipo: 'despesa', categoriaId: despesa.json().id, descricao: 'X Y', valorCentavos: 10.5, data: '2026-03-05' })).statusCode).toBe(400)

    // outra academia não enxerga nem usa a categoria
    expect((await chamar(amb, gestorB, 'POST', '/transacoes', { tipo: 'despesa', categoriaId: despesa.json().id, descricao: 'Intruso', valorCentavos: 100, data: '2026-03-05' })).statusCode).toBe(422)
    expect((await chamar(amb, gestorB, 'PATCH', `/transacoes/${novo.json().id}`, { descricao: 'Hack' })).statusCode).toBe(404)
    expect((await chamar(amb, gestorB, 'DELETE', `/transacoes/${novo.json().id}`)).statusCode).toBe(404)

    expect((await chamar(amb, gestorA, 'DELETE', `/transacoes/${novo.json().id}`)).statusCode).toBe(204)
    expect((await lista(gestorA, '/transacoes?mes=2026-03&tipo=despesa')).total).toBe(0)
  })

  it('lançamento vindo de cobrança não pode ser apagado nem ter valor alterado', async () => {
    const aberta = (await lista(gestorA, '/cobrancas?competencia=2026-03&status=aberta&limite=200')).itens.find((c: any) => c.valorCentavos > 0)
    await chamar(amb, gestorA, 'POST', `/cobrancas/${aberta.id}/pagar`, {})
    const tx = (await lista(gestorA, '/transacoes?mes=2026-03&tipo=receita')).itens.find((t: any) => t.cobrancaId === aberta.id)
    expect(tx).toBeTruthy()
    expect((await chamar(amb, gestorA, 'DELETE', `/transacoes/${tx.id}`)).json().erro.codigo).toBe('transacao_de_cobranca')
    expect((await chamar(amb, gestorA, 'PATCH', `/transacoes/${tx.id}`, { valorCentavos: 1 })).statusCode).toBe(409)
    expect((await chamar(amb, gestorA, 'PATCH', `/transacoes/${tx.id}`, { conciliada: true })).statusCode).toBe(200)
  })
})
