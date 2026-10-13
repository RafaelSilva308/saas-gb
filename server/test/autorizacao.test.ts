import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chamar, criarAmbiente, entrar, HOJE, novaAcademia, SENHA_DEMO, type Ambiente } from './ajuda.js'

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

const itens = async (cookie: string, url: string) => (await chamar(amb, cookie, 'GET', url)).json().itens as Record<string, any>[]

describe('papéis', () => {
  it('professor lê planos mas não altera; gestor altera (valores em centavos)', async () => {
    expect((await chamar(amb, profA, 'GET', '/planos')).statusCode).toBe(200)
    const corpo = { nome: 'Teste', valorCentavos: 12345 }
    expect((await chamar(amb, profA, 'POST', '/planos', corpo)).statusCode).toBe(403)
    const ok = await chamar(amb, gestorA, 'POST', '/planos', corpo)
    expect(ok.statusCode).toBe(201)
    expect(ok.json()).toMatchObject({ valorCentavos: 12345, aulasPorSemana: null })
    expect((await chamar(amb, gestorA, 'POST', '/planos', corpo)).json().erro.codigo).toBe('plano_duplicado')
    expect((await chamar(amb, gestorA, 'POST', '/planos', { nome: 'X', valorCentavos: 10.5 })).statusCode).toBe(400)
  })

  it('aluno não acessa cadastro de alunos, planos nem dados de outros alunos', async () => {
    for (const url of ['/alunos', '/planos', `/alunos/${B.alunoDemoId}`, `/alunos/${A.alunoDemoId}/presencas`]) {
      expect((await chamar(amb, alunoA, 'GET', url)).statusCode, url).toBe(403)
    }
    expect((await chamar(amb, alunoA, 'POST', '/alunos', { nome: 'Fulano' })).statusCode).toBe(403)
  })

  it('professor não cria turma nem exclui aluno; todos os papéis leem o quadro', async () => {
    expect((await chamar(amb, profA, 'POST', '/turmas', { nome: 'Nova' })).statusCode).toBe(403)
    expect((await chamar(amb, profA, 'DELETE', `/alunos/${A.alunoDemoId}`)).statusCode).toBe(403)
    for (const c of [gestorA, profA, alunoA]) {
      expect((await itens(c, '/turmas')).length).toBe(5)
      expect((await itens(c, '/aulas')).length).toBe(15)
    }
  })

  it('aluno não altera o quadro de aulas', async () => {
    expect((await chamar(amb, alunoA, 'POST', '/aulas', { turmaId: '00000000-0000-4000-8000-000000000000' })).statusCode).toBe(403)
  })
})

describe('isolamento entre academias', () => {
  it('listagens só trazem a própria academia', async () => {
    const idsB = new Set((await itens(gestorB, '/alunos?limite=200')).map((a) => a.id))
    const listaA = await itens(gestorA, '/alunos?limite=200')
    expect(listaA.length).toBe(35)
    expect(listaA.some((a) => idsB.has(a.id))).toBe(false)
    const turmasB = new Set((await itens(gestorB, '/turmas')).map((t) => t.id))
    expect((await itens(gestorA, '/turmas')).some((t) => turmasB.has(t.id))).toBe(false)
  })

  it('não lê, altera, exclui nem gradua aluno de outra academia (404)', async () => {
    const id = B.alunoDemoId
    expect((await chamar(amb, gestorA, 'GET', `/alunos/${id}`)).statusCode).toBe(404)
    expect((await chamar(amb, gestorA, 'PATCH', `/alunos/${id}`, { nome: 'Invasor' })).statusCode).toBe(404)
    expect((await chamar(amb, gestorA, 'DELETE', `/alunos/${id}`)).statusCode).toBe(404)
    expect((await chamar(amb, gestorA, 'GET', `/alunos/${id}/presencas`)).statusCode).toBe(404)
    expect((await chamar(amb, gestorA, 'POST', `/alunos/${id}/graduacoes`, { faixa: 'preta' })).statusCode).toBe(404)
    expect((await chamar(amb, gestorA, 'POST', `/alunos/${id}/acesso`, { email: 'x@y.com' })).statusCode).toBe(404)
    const { rows } = await amb.db.query('select nome, faixa from aluno where id = $1', [id])
    expect(rows[0].nome).toBe('Pedro Almeida')
  })

  it('não referencia plano, turma ou aula de outra academia', async () => {
    const planoB = (await itens(gestorB, '/planos'))[0]!.id
    const turmaB = (await itens(gestorB, '/turmas'))[0]!.id
    const aulaB = (await itens(gestorB, '/aulas'))[0]!.id
    const r1 = await chamar(amb, gestorA, 'POST', '/alunos', { nome: 'Teste Plano', planoId: planoB })
    expect(r1.statusCode).toBe(422)
    const r2 = await chamar(amb, gestorA, 'POST', '/alunos', { nome: 'Teste Turma', turmaIds: [turmaB] })
    expect(r2.statusCode).toBe(422)
    expect((await chamar(amb, gestorA, 'PATCH', `/planos/${planoB}`, { nome: 'XY' })).statusCode).toBe(404)
    expect((await chamar(amb, gestorA, 'PATCH', `/turmas/${turmaB}`, { nome: 'XY' })).statusCode).toBe(404)
    expect((await chamar(amb, gestorA, 'PATCH', `/aulas/${aulaB}`, { titulo: 'XY' })).statusCode).toBe(404)
    expect((await chamar(amb, gestorA, 'GET', `/chamadas?aulaId=${aulaB}&data=${HOJE}`)).statusCode).toBe(404)
    expect((await chamar(amb, alunoA, 'POST', `/aulas/${aulaB}/checkin`)).statusCode).toBe(404)
    const aulaA = (await itens(gestorA, '/aulas')).find((a) => a.titulo === 'Raspagens')!.id
    expect((await chamar(amb, gestorA, 'PUT', `/chamadas/${aulaA}/${HOJE}/presencas/${B.alunoDemoId}`, { status: 'presente' })).statusCode).toBe(404)
  })

  it('o academiaId enviado no corpo é ignorado', async () => {
    const r = await chamar(amb, gestorA, 'POST', '/alunos', { nome: 'Sem Truque', academiaId: B.academiaId })
    expect(r.statusCode).toBe(201)
    const { rows } = await amb.db.query('select academia_id from aluno where id = $1', [r.json().id])
    expect(rows[0].academia_id).toBe(A.academiaId)
  })
})

describe('cadastro de alunos', () => {
  it('cria com turmas, consentimento gravado pelo servidor e graduação inicial', async () => {
    const turma = (await itens(gestorA, '/turmas'))[0]!.id
    const r = await chamar(amb, profA, 'POST', '/alunos', {
      nome: '  Ana Teste ',
      email: 'ANA@Teste.com',
      telefone: '',
      faixa: 'azul',
      graus: 1,
      status: 'ativo',
      turmaIds: [turma],
      consentimento: { por: 'Ana Teste' },
    })
    expect(r.statusCode).toBe(201)
    const a = r.json()
    expect(a).toMatchObject({ nome: 'Ana Teste', email: 'ana@teste.com', telefone: null, faixa: 'azul', turmaIds: [turma], temAcesso: false })
    expect(a.consentimento.por).toBe('Ana Teste')
    expect(new Date(a.consentimento.em).getTime()).toBeGreaterThan(Date.now() - 60_000)
    const g = await itens(gestorA, `/alunos/${a.id}/graduacoes`)
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ faixa: 'azul', graus: 1 })
  })

  it('valida dados: nome curto, e-mail inválido, responsável pela metade', async () => {
    const r = await chamar(amb, gestorA, 'POST', '/alunos', { nome: 'A', email: 'nao-e-email', responsavel: { nome: 'Mãe', telefone: '' } })
    expect(r.statusCode).toBe(400)
    expect(Object.keys(r.json().erro.campos)).toEqual(expect.arrayContaining(['nome', 'email']))
  })

  it('filtra por busca, status e faixa, com paginação', async () => {
    const p1 = (await chamar(amb, gestorA, 'GET', '/alunos?limite=10&pagina=1')).json()
    expect(p1).toMatchObject({ total: expect.any(Number), pagina: 1, limite: 10 })
    expect(p1.itens).toHaveLength(10)
    const p2 = (await chamar(amb, gestorA, 'GET', '/alunos?limite=10&pagina=2')).json()
    expect(p2.itens[0].id).not.toBe(p1.itens[0].id)

    const busca = await itens(gestorA, '/alunos?busca=almeida')
    expect(busca.map((a) => a.nome)).toContain('Pedro Almeida')
    expect((await itens(gestorA, '/alunos?busca=%25')).length).toBe(0)
    const inativos = await itens(gestorA, '/alunos?status=inativo&limite=200')
    expect(inativos.length).toBeGreaterThan(0)
    expect(inativos.every((a) => a.status === 'inativo')).toBe(true)
  })

  it('mudar a faixa grava graduação; atualizar turmas preserva o vínculo antigo com data de saída', async () => {
    const turmas = await itens(gestorA, '/turmas')
    const r = await chamar(amb, gestorA, 'POST', '/alunos', { nome: 'Bia Troca', turmaIds: [turmas[0]!.id] })
    const id = r.json().id
    const p = await chamar(amb, gestorA, 'PATCH', `/alunos/${id}`, { faixa: 'roxa', graus: 2, turmaIds: [turmas[1]!.id] })
    expect(p.statusCode).toBe(200)
    expect(p.json()).toMatchObject({ faixa: 'roxa', graus: 2, turmaIds: [turmas[1]!.id] })
    expect(await itens(gestorA, `/alunos/${id}/graduacoes`)).toHaveLength(2)
    const { rows } = await amb.db.query('select turma_id, ate from aluno_turma where aluno_id = $1', [id])
    expect(rows).toHaveLength(2)
    const log = await amb.db.query(`select 1 from log_auditoria where entidade_id = $1 and acao = 'aluno.atualizar'`, [id])
    expect(log.rowCount).toBe(1)
  })

  it('graduar atualiza o estado atual do aluno', async () => {
    const r = await chamar(amb, profA, 'POST', `/alunos/${A.alunoDemoId}/graduacoes`, { faixa: 'preta', graus: 3, observacao: 'Promoção' })
    expect(r.statusCode).toBe(201)
    expect((await chamar(amb, gestorA, 'GET', `/alunos/${A.alunoDemoId}`)).json()).toMatchObject({ faixa: 'preta', graus: 3 })
  })

  it('só o gestor exclui; aluno com histórico não pode ser excluído', async () => {
    expect((await chamar(amb, gestorA, 'DELETE', `/alunos/${A.alunoDemoId}`)).json().erro.codigo).toBe('aluno_com_historico')
    const novo = (await chamar(amb, gestorA, 'POST', '/alunos', { nome: 'Sem Historico' })).json().id
    expect((await chamar(amb, gestorA, 'DELETE', `/alunos/${novo}`)).statusCode).toBe(204)
    expect((await chamar(amb, gestorA, 'GET', `/alunos/${novo}`)).statusCode).toBe(404)
  })

  it('histórico de presença marca aulas realizadas sem registro como sem_checkin', async () => {
    const r = await chamar(amb, profA, 'GET', `/alunos/${A.alunoDemoId}/presencas?dias=45`)
    expect(r.statusCode).toBe(200)
    const situ = new Set((r.json().itens as { situacao: string }[]).map((i) => i.situacao))
    expect(situ.has('presente')).toBe(true)
    expect(situ.has('sem_checkin')).toBe(true)
  })
})

describe('acesso do aluno por convite', () => {
  it('cria o login, envia o convite e o aluno define a senha e entra', async () => {
    const novo = (await chamar(amb, gestorA, 'POST', '/alunos', { nome: 'Carla Convite', email: 'carla@convite.com' })).json()
    amb.emails.length = 0
    const r = await chamar(amb, gestorA, 'POST', `/alunos/${novo.id}/acesso`)
    expect(r.statusCode).toBe(201)
    expect(amb.emails.at(-1)!.para).toBe('carla@convite.com')
    const token = /token=([\w-]+)/.exec(amb.emails.at(-1)!.texto)![1]!

    expect((await chamar(amb, undefined, 'POST', '/auth/login', { email: 'carla@convite.com', senha: SENHA_DEMO })).statusCode).toBe(401)
    expect((await chamar(amb, undefined, 'POST', '/auth/redefinir-senha', { token, senha: 'minha-senha-123' })).statusCode).toBe(204)
    const login = await chamar(amb, undefined, 'POST', '/auth/login', { email: 'carla@convite.com', senha: 'minha-senha-123' })
    expect(login.statusCode).toBe(200)
    expect(login.json().usuario).toMatchObject({ papel: 'aluno', alunoId: novo.id })

    expect((await chamar(amb, gestorA, 'POST', `/alunos/${novo.id}/acesso`)).json().erro.codigo).toBe('acesso_existente')
  })

  it('recusa convite sem e-mail e e-mail já usado', async () => {
    const semEmail = (await chamar(amb, gestorA, 'POST', '/alunos', { nome: 'Sem Email' })).json().id
    expect((await chamar(amb, gestorA, 'POST', `/alunos/${semEmail}/acesso`)).statusCode).toBe(422)
    const r = await chamar(amb, gestorA, 'POST', `/alunos/${semEmail}/acesso`, { email: `gestor@${A.sufixo}` })
    expect(r.json().erro.codigo).toBe('email_em_uso')
  })
})

describe('quadro de aulas', () => {
  it('professor cria, edita e remove aula; aula com chamadas só é desativada', async () => {
    const turma = (await itens(profA, '/turmas'))[0]!.id
    const nova = await chamar(amb, profA, 'POST', '/aulas', { turmaId: turma, titulo: 'Extra', diaSemana: 6, inicio: '09:00', fim: '10:00', capacidade: 15 })
    expect(nova.statusCode).toBe(201)
    const id = nova.json().id
    expect((await chamar(amb, profA, 'PATCH', `/aulas/${id}`, { fim: '08:00' })).statusCode).toBe(422)
    expect((await chamar(amb, profA, 'PATCH', `/aulas/${id}`, { capacidade: 20 })).json().capacidade).toBe(20)
    expect((await chamar(amb, profA, 'DELETE', `/aulas/${id}`)).statusCode).toBe(204)
    expect((await amb.db.query('select 1 from aula where id = $1', [id])).rowCount).toBe(0)

    const comHistorico = (await itens(profA, '/aulas')).find((a) => a.titulo === 'Sparring')!.id
    await chamar(amb, profA, 'PUT', `/chamadas/${comHistorico}/${HOJE}/presencas/${A.alunoDemoId}`, { status: 'presente' })
    expect((await chamar(amb, profA, 'DELETE', `/aulas/${comHistorico}`)).statusCode).toBe(204)
    expect((await amb.db.query('select ativa from aula where id = $1', [comHistorico])).rows[0].ativa).toBe(false)
  })
})
