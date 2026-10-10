import { fileURLToPath } from 'node:url'
import { hashSenha } from '../auth/senha.js'
import { diaDaSemana } from '../datas.js'
import { criarCategoriasPadrao } from '../financeiro.js'
import { comTransacao, criarPool, type Db } from './pool.js'

/** Mesmos dados da demonstração do front (e-mails fictícios, senha `treino123`). Não usar em produção. */
export const SENHA_DEMO = 'treino123'

const PLANOS = [
  ['Fundamentos', 'Duas aulas por semana na turma de fundamentos. Ideal para quem está começando.', 18000, 'mensal', 2, true],
  ['Integral', 'Acesso a todas as turmas do quadro de horários, sem limite de aulas.', 26000, 'mensal', null, true],
  ['Kids', 'Turmas infantis e juvenis, três vezes por semana, com acompanhamento pedagógico.', 16000, 'mensal', 3, true],
  ['Integral Anual', 'Plano integral com pagamento anual e desconto equivalente a dois meses.', 260000, 'anual', null, true],
  ['Competição', 'Treino integral mais sessões de preparação para campeonatos.', 34000, 'mensal', null, false],
] as const

// [nome, professor ('p' | 'g'), faixa etária, nível, infantil, cor]
const TURMAS = [
  ['Fundamentos', 'p', 'Adulto', 'Iniciante', false, '#1764a8'],
  ['Avançada', 'p', 'Adulto', 'Azul+', false, '#12507f'],
  ['Kids 7–11', 'g', '7 a 11 anos', 'Infantil', true, '#246db1'],
  ['Juvenil 12–15', 'g', '12 a 15 anos', 'Juvenil', true, '#7fabd8'],
  ['No-Gi', 'p', 'Adulto', 'Livre', false, '#667085'],
] as const

// [turma (índice), título, dia, início, fim, capacidade, local]
const AULAS = [
  [0, 'Fundamentos de Guarda', 1, '19:00', '20:00', 30, 'Tatame 1'],
  [4, 'Treino Livre', 1, '06:30', '07:30', 20, 'Tatame 1'],
  [2, 'Kids — Base e Quedas', 1, '17:00', '17:50', 24, 'Tatame 2'],
  [1, 'Condicionamento', 2, '07:00', '08:00', 24, 'Tatame 1'],
  [0, 'Posicionamento', 2, '19:00', '20:00', 30, 'Tatame 1'],
  [3, 'Juvenil — Passagem', 2, '18:00', '19:00', 20, 'Tatame 2'],
  [0, 'Raspagens', 3, '19:00', '20:00', 30, 'Tatame 1'],
  [1, 'Sparring', 3, '20:00', '21:00', 30, 'Tatame 1'],
  [2, 'Kids — Jogos de Guarda', 3, '17:00', '17:50', 24, 'Tatame 2'],
  [4, 'No-Gi — Controle', 4, '06:30', '07:30', 20, 'Tatame 1'],
  [0, 'Finalizações', 4, '19:00', '20:00', 30, 'Tatame 1'],
  [3, 'Juvenil — Sparring', 4, '18:00', '19:00', 20, 'Tatame 2'],
  [1, 'Avançada — Guarda Aberta', 5, '19:00', '20:30', 30, 'Tatame 1'],
  [2, 'Kids — Recreativo', 5, '17:00', '17:50', 24, 'Tatame 2'],
  [4, 'Open Mat', 6, '10:00', '11:30', 40, 'Tatame 1'],
] as const

const NOMES = [
  'Pedro Almeida', 'Maria Santos', 'João Ferreira', 'Lucas Mendes', 'Beatriz Lima',
  'Rafael Costa', 'Camila Rocha', 'Thiago Barbosa', 'Juliana Prado', 'Gustavo Nunes',
  'Larissa Teixeira', 'Bruno Carvalho', 'Amanda Ribeiro', 'Felipe Andrade', 'Isabela Cardoso',
  'Marcelo Pires', 'Fernanda Duarte', 'Vitor Machado', 'Carolina Souza', 'Diego Ramos',
  'Patrícia Alves', 'Henrique Moreira', 'Natália Freitas', 'Eduardo Campos', 'Sofia Martins',
  'André Batista', 'Letícia Gomes', 'Rodrigo Pinto', 'Mariana Vieira', 'Caio Monteiro',
  'Helena Braga', 'Otávio Lopes', 'Clara Fonseca', 'Igor Salgado', 'Débora Antunes',
]

const FAIXAS_ADULTO = ['branca', 'branca', 'branca', 'azul', 'azul', 'roxa', 'marrom', 'preta'] as const
const FAIXAS_KIDS = ['branca', 'cinza', 'amarela', 'laranja', 'verde'] as const

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const somaDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ /g, '.')

export interface ResultadoSeed {
  academiaId: string
  alunoDemoId: string
}

/** Cria uma academia completa de demonstração. `hoje` (AAAA-MM-DD) ancora o histórico de aulas. */
export async function semear(db: Db, hoje: string, sufixoEmail = 'redshield.com.br'): Promise<ResultadoSeed> {
  const rand = rng(20260822)
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]!
  const senhaHash = await hashSenha(SENHA_DEMO)

  return comTransacao(db, async (c) => {
    const academiaId = (await c.query(`insert into academia (nome) values ('REDSHIELD') returning id`)).rows[0].id as string

    const usuario = async (nome: string, email: string, papel: string, alunoId: string | null = null) =>
      (
        await c.query(
          `insert into usuario (academia_id, nome, email, papel, aluno_id, senha_hash) values ($1,$2,$3,$4,$5,$6) returning id`,
          [academiaId, nome, email, papel, alunoId, senhaHash],
        )
      ).rows[0].id as string
    const prof = { p: await usuario('Professor Carlos Vasques', `professor@${sufixoEmail}`, 'professor'), g: '' }
    prof.g = await usuario('Renata Moura', `gestor@${sufixoEmail}`, 'gestor')

    const planoIds: string[] = []
    for (const [nome, descricao, valor, per, aulas, ativo] of PLANOS) {
      planoIds.push(
        (
          await c.query(
            `insert into plano (academia_id, nome, descricao, valor_centavos, periodicidade, aulas_por_semana, ativo)
             values ($1,$2,$3,$4,$5,$6,$7) returning id`,
            [academiaId, nome, descricao, valor, per, aulas, ativo],
          )
        ).rows[0].id,
      )
    }

    const turmaIds: string[] = []
    for (const [nome, quem, faixaEtaria, nivel, infantil, cor] of TURMAS) {
      turmaIds.push(
        (
          await c.query(
            `insert into turma (academia_id, nome, professor_id, faixa_etaria, nivel, infantil, cor)
             values ($1,$2,$3,$4,$5,$6,$7) returning id`,
            [academiaId, nome, prof[quem], faixaEtaria, nivel, infantil, cor],
          )
        ).rows[0].id,
      )
    }

    const aulas: { id: string; turmaIdx: number; dia: number }[] = []
    for (const [t, titulo, dia, ini, fim, cap, local] of AULAS) {
      const id = (
        await c.query(
          `insert into aula (academia_id, turma_id, titulo, dia_semana, inicio, fim, capacidade, local)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [academiaId, turmaIds[t], titulo, dia, ini, fim, cap, local],
        )
      ).rows[0].id as string
      aulas.push({ id, turmaIdx: t, dia })
    }

    // Alunos e vínculos com turmas.
    const matriculados: { id: string; turmas: number[]; ativo: boolean }[] = []
    let alunoDemoId = ''
    for (const [i, nome] of NOMES.entries()) {
      const kids = i % 5 === 2
      const faixa = kids ? pick(FAIXAS_KIDS) : pick(FAIXAS_ADULTO)
      const status = i % 11 === 4 ? 'inativo' : i % 9 === 7 ? 'experimental' : 'ativo'
      const nascAno = kids ? int(2012, 2018) : int(1978, 2006)
      const matricula = somaDias(hoje, i % 8 === 3 ? -int(1, 26) : -int(60, 1400))
      const planoIdx = kids ? 2 : pick([0, 1, 1, 3])
      const tel = () => `(11) 9${int(4000, 9999)}-${int(1000, 9999)}`
      const { rows } = await c.query(
        `insert into aluno (academia_id, nome, email, telefone, nascimento, faixa, graus, status, matricula_em, plano_id,
                            vencimento_dia, responsavel_nome, responsavel_telefone, observacoes,
                            consentimento_em, consentimento_por)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),$15) returning id`,
        [
          academiaId, nome, i === 0 ? `aluno@${sufixoEmail}` : `${semAcento(nome)}@email.com`, tel(),
          `${nascAno}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`,
          faixa, faixa === 'preta' ? int(0, 2) : int(0, 4), status, matricula, planoIds[planoIdx],
          pick([5, 5, 10, 10, 15, 20, 25]),
          kids ? `Responsável de ${nome.split(' ')[0]}` : null, kids ? tel() : null,
          i % 7 === 0 ? 'Recuperando lesão no joelho direito. Evitar quedas por 30 dias.' : null,
          kids ? `Responsável de ${nome.split(' ')[0]}` : nome,
        ],
      )
      const id = rows[0].id as string
      await c.query(
        `insert into graduacao (academia_id, aluno_id, faixa, graus, data, observacao)
         select academia_id, id, faixa, graus, matricula_em, 'Matrícula' from aluno where id = $1`,
        [id],
      )
      const turmas = kids ? [i % 10 === 2 ? 2 : 3] : faixa === 'branca' ? [0] : [0, 1, ...(i % 3 === 0 ? [4] : [])]
      for (const t of turmas) {
        await c.query('insert into aluno_turma (aluno_id, turma_id, desde) values ($1,$2,$3)', [id, turmaIds[t], matricula])
      }
      matriculados.push({ id, turmas, ativo: status !== 'inativo' })
      if (i === 0) alunoDemoId = id
    }
    await usuario('Pedro Almeida', `aluno@${sufixoEmail}`, 'aluno', alunoDemoId)

    // Histórico dos últimos 45 dias: cada aula do quadro vira uma chamada; quem "fez check-in" tem linha de presença.
    // Alguns dias não têm chamada nenhuma (feriado esquecido), e o dia de hoje fica em aberto para a demonstração.
    for (let d = -45; d < 0; d++) {
      const data = somaDias(hoje, d)
      if (int(1, 14) === 1) continue
      for (const aula of aulas.filter((a) => a.dia === diaDaSemana(data))) {
        const inscritos = matriculados.filter((m) => m.ativo && m.turmas.includes(aula.turmaIdx))
        const quem = inscritos.filter(() => rand() < 0.72)
        if (!quem.length) continue
        const ch = (
          await c.query('insert into chamada (academia_id, aula_id, data) values ($1,$2,$3) returning id', [academiaId, aula.id, data])
        ).rows[0].id as string
        for (const m of quem) {
          await c.query(`insert into presenca (chamada_id, aluno_id, status, origem) values ($1,$2,'presente','aluno')`, [ch, m.id])
        }
      }
    }

    return { academiaId, alunoDemoId }
  })
}

const executadoDireto = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (executadoDireto) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('Defina DATABASE_URL.')
    process.exit(1)
  }
  if (process.env.NODE_ENV === 'production' && process.env.PERMITIR_SEED !== 'sim') {
    console.error('Recusado em produção. Defina PERMITIR_SEED=sim se for de propósito.')
    process.exit(1)
  }
  const db = criarPool(url, 1)
  const jaExiste = (await db.query(`select 1 from usuario where lower(email) = 'gestor@redshield.com.br'`)).rowCount
  if (jaExiste) {
    console.error('A academia de demonstração já existe neste banco. Nada foi feito.')
    process.exitCode = 1
  } else {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const { academiaId } = await semear(db, hoje)
    await criarCategoriasPadrao(db, academiaId)
    console.log('Academia de demonstração criada. Entre com gestor@redshield.com.br / treino123.')
  }
  await db.end()
}
