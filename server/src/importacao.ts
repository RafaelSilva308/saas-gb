/** Leitor de CSV (RFC 4180 simplificado): aspas duplas, vírgula ou ponto e vírgula, BOM, quebras CRLF/LF. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '')
  const primeira = t.split(/\r?\n/, 1)[0] ?? ''
  const sep = (primeira.match(/;/g)?.length ?? 0) > (primeira.match(/,/g)?.length ?? 0) ? ';' : ','
  const linhas: string[][] = []
  let linha: string[] = []
  let campo = ''
  let aspas = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!
    if (aspas) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          campo += '"'
          i++
        } else aspas = false
      } else campo += ch
    } else if (ch === '"' && campo === '') aspas = true
    else if (ch === sep) {
      linha.push(campo)
      campo = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      linha.push(campo)
      campo = ''
      if (linha.some((c) => c.trim() !== '')) linhas.push(linha)
      linha = []
    } else campo += ch
  }
  linha.push(campo)
  if (linha.some((c) => c.trim() !== '')) linhas.push(linha)
  return linhas
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

export const COLUNAS = {
  nome: ['nome', 'aluno', 'nome_completo'],
  email: ['email', 'e_mail'],
  telefone: ['telefone', 'celular', 'whatsapp', 'fone'],
  nascimento: ['nascimento', 'data_de_nascimento', 'data_nascimento'],
  faixa: ['faixa'],
  graus: ['graus', 'grau'],
  status: ['status', 'situacao'],
  matricula: ['matricula', 'matricula_em', 'data_de_matricula', 'inicio'],
  plano: ['plano'],
  vencimentoDia: ['vencimento', 'dia_de_vencimento', 'dia_vencimento', 'vencimento_dia'],
  responsavelNome: ['responsavel', 'responsavel_nome', 'nome_do_responsavel'],
  responsavelTelefone: ['telefone_do_responsavel', 'responsavel_telefone', 'telefone_responsavel'],
  observacoes: ['observacoes', 'observacao', 'obs'],
} as const
export type Coluna = keyof typeof COLUNAS

/** Mapeia o cabeçalho do arquivo para as colunas conhecidas (ignora acentos, caixa e espaços). Colunas desconhecidas são ignoradas. */
export function mapearCabecalho(cabecalho: string[]): Map<Coluna, number> {
  const mapa = new Map<Coluna, number>()
  cabecalho.forEach((c, i) => {
    const chave = semAcento(c)
    for (const [col, nomes] of Object.entries(COLUNAS) as [Coluna, readonly string[]][]) {
      if (nomes.includes(chave) && !mapa.has(col)) mapa.set(col, i)
    }
  })
  return mapa
}

/** Aceita AAAA-MM-DD e DD/MM/AAAA (e DD-MM-AAAA). Devolve ISO ou null se inválida. */
export function dataParaIso(v: string): string | null {
  const s = v.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s)
  const partes = iso ? [iso[1]!, iso[2]!, iso[3]!] : br ? [br[3]!, br[2]!, br[1]!] : null
  if (!partes) return null
  const resultado = `${partes[0]}-${partes[1]!.padStart(2, '0')}-${partes[2]!.padStart(2, '0')}`
  const dt = new Date(`${resultado}T00:00:00Z`)
  return Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== resultado ? null : resultado
}

const FAIXAS = ['branca', 'cinza', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'marrom', 'preta']
const STATUS_ALUNO: Record<string, 'ativo' | 'inativo' | 'experimental'> = { ativo: 'ativo', ativa: 'ativo', inativo: 'inativo', inativa: 'inativo', experimental: 'experimental', teste: 'experimental' }

export interface AlunoImportado {
  nome: string
  email: string | null
  telefone: string | null
  nascimento: string | null
  faixa: string
  graus: number
  status: 'ativo' | 'inativo' | 'experimental'
  matriculaEm: string | null
  planoNome: string | null
  vencimentoDia: number
  responsavelNome: string | null
  responsavelTelefone: string | null
  observacoes: string | null
}

export type LinhaLida = { ok: true; linha: number; aluno: AlunoImportado } | { ok: false; linha: number; motivo: string }

/** Valida cada linha do arquivo sem tocar no banco. `linha` é o número da linha no arquivo (cabeçalho = 1). */
export function interpretarLinhas(linhas: string[][], hojeIso: string): { linhas: LinhaLida[]; colunasReconhecidas: Coluna[] } | { erro: string } {
  if (linhas.length < 2) return { erro: 'O arquivo precisa ter o cabeçalho e ao menos uma linha de dados.' }
  const mapa = mapearCabecalho(linhas[0]!)
  if (!mapa.has('nome')) return { erro: 'Não achei a coluna "nome" no cabeçalho.' }
  const get = (l: string[], c: Coluna) => {
    const i = mapa.get(c)
    const v = i === undefined ? '' : (l[i] ?? '').trim()
    return v === '' ? null : v
  }
  const saida: LinhaLida[] = linhas.slice(1).map((l, idx) => {
    const linha = idx + 2
    const rej = (motivo: string): LinhaLida => ({ ok: false, linha, motivo })
    const nome = get(l, 'nome')
    if (!nome || nome.length < 2) return rej('Nome ausente ou curto demais.')
    if (nome.length > 120) return rej('Nome com mais de 120 caracteres.')

    const email = get(l, 'email')?.toLowerCase() ?? null
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return rej(`E-mail inválido: ${email}`)

    const nascTxt = get(l, 'nascimento')
    const nascimento = nascTxt ? dataParaIso(nascTxt) : null
    if (nascTxt && !nascimento) return rej(`Data de nascimento inválida: ${nascTxt}`)
    if (nascimento && nascimento >= hojeIso) return rej('Data de nascimento no futuro.')

    const matTxt = get(l, 'matricula')
    const matriculaEm = matTxt ? dataParaIso(matTxt) : null
    if (matTxt && !matriculaEm) return rej(`Data de matrícula inválida: ${matTxt}`)
    if (matriculaEm && matriculaEm > hojeIso) return rej('Data de matrícula no futuro.')

    const faixa = semAcento(get(l, 'faixa') ?? 'branca')
    if (!FAIXAS.includes(faixa)) return rej(`Faixa desconhecida: ${get(l, 'faixa')}`)

    const grausTxt = get(l, 'graus')
    const graus = grausTxt === null ? 0 : Number(grausTxt)
    if (!Number.isInteger(graus) || graus < 0 || graus > 6) return rej(`Graus inválidos: ${grausTxt}`)

    const statusTxt = get(l, 'status')
    const status = statusTxt ? STATUS_ALUNO[semAcento(statusTxt)] : 'ativo'
    if (!status) return rej(`Status desconhecido: ${statusTxt}`)

    const vencTxt = get(l, 'vencimentoDia')
    const vencimentoDia = vencTxt === null ? 10 : Number(vencTxt)
    if (!Number.isInteger(vencimentoDia) || vencimentoDia < 1 || vencimentoDia > 28) return rej(`Dia de vencimento deve ser de 1 a 28: ${vencTxt}`)

    const respNome = get(l, 'responsavelNome')
    const respTel = get(l, 'responsavelTelefone')
    if (!!respNome !== !!respTel) return rej('Informe nome e telefone do responsável juntos.')

    return {
      ok: true,
      linha,
      aluno: {
        nome, email, telefone: get(l, 'telefone'), nascimento, faixa, graus, status, matriculaEm,
        planoNome: get(l, 'plano'), vencimentoDia, responsavelNome: respNome, responsavelTelefone: respTel, observacoes: get(l, 'observacoes'),
      },
    }
  })
  return { linhas: saida, colunasReconhecidas: [...mapa.keys()] }
}
