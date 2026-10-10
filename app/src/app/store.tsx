import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { ALUNOS, AULAS, CHAMADAS, PLANOS, TRANSACOES } from '@/data/mock'
import type { Aluno, Aula, ChamadaAula, Plano, StatusPresenca, Transacao } from '@/types'

/* Store em memória.
   Cada função aqui corresponde a um endpoint planejado na Fase 2
   (ver seção "Contrato de API" do PLANO_DESENVOLVIMENTO.md).
   Trocar este arquivo por TanStack Query + fetch é o único ponto de costura. */

interface Store {
  alunos: Aluno[]
  planos: Plano[]
  aulas: Aula[]
  chamadas: ChamadaAula[]
  transacoes: Transacao[]

  salvarAluno: (a: Aluno) => void
  removerAluno: (id: string) => void

  salvarPlano: (p: Plano) => void
  alternarPlano: (id: string) => void

  salvarAula: (a: Aula) => void
  removerAula: (id: string) => void

  marcarPresenca: (aulaId: string, data: string, alunoId: string, status: StatusPresenca) => void
  fecharChamada: (aulaId: string, data: string) => void
  chamadaDe: (aulaId: string, data: string) => ChamadaAula | undefined

  salvarTransacao: (t: Transacao) => void
  removerTransacao: (id: string) => void

}

const StoreCtx = createContext<Store | null>(null)

const novoId = (prefixo: string) => `${prefixo}${Date.now().toString(36)}`

export function StoreProvider({ children }: { children: ReactNode }) {
  const [alunos, setAlunos] = useState<Aluno[]>(ALUNOS)
  const [planos, setPlanos] = useState<Plano[]>(PLANOS)
  const [aulas, setAulas] = useState<Aula[]>(AULAS)
  const [chamadas, setChamadas] = useState<ChamadaAula[]>(CHAMADAS)
  const [transacoes, setTransacoes] = useState<Transacao[]>(TRANSACOES)

  const upsert = <T extends { id: string }>(lista: T[], item: T) =>
    lista.some((x) => x.id === item.id) ? lista.map((x) => (x.id === item.id ? item : x)) : [item, ...lista]

  const salvarAluno = useCallback((a: Aluno) => {
    setAlunos((atual) => upsert(atual, a.id ? a : { ...a, id: novoId('al') }))
  }, [])

  const removerAluno = useCallback((id: string) => {
    setAlunos((atual) => atual.filter((a) => a.id !== id))
  }, [])

  const salvarPlano = useCallback((p: Plano) => {
    setPlanos((atual) => upsert(atual, p.id ? p : { ...p, id: novoId('p') }))
  }, [])

  const alternarPlano = useCallback((id: string) => {
    setPlanos((atual) => atual.map((p) => (p.id === id ? { ...p, ativo: !p.ativo } : p)))
  }, [])

  const salvarAula = useCallback((a: Aula) => {
    setAulas((atual) => upsert(atual, a.id ? a : { ...a, id: novoId('a') }))
  }, [])

  const removerAula = useCallback((id: string) => {
    setAulas((atual) => atual.filter((a) => a.id !== id))
  }, [])

  const marcarPresenca = useCallback((aulaId: string, data: string, alunoId: string, status: StatusPresenca) => {
    setChamadas((atual) => {
      const idx = atual.findIndex((c) => c.aulaId === aulaId && c.data === data)
      if (idx === -1) {
        return [...atual, { id: `ch-${data}-${aulaId}`, aulaId, data, registros: [{ alunoId, status }], fechada: false }]
      }
      const alvo = atual[idx]
      const existente = alvo.registros.find((r) => r.alunoId === alunoId)
      const registros = existente
        ? alvo.registros.map((r) => (r.alunoId === alunoId ? { ...r, status } : r))
        : [...alvo.registros, { alunoId, status }]
      const copia = [...atual]
      copia[idx] = { ...alvo, registros }
      return copia
    })
  }, [])

  const fecharChamada = useCallback((aulaId: string, data: string) => {
    setChamadas((atual) =>
      atual.map((c) => (c.aulaId === aulaId && c.data === data ? { ...c, fechada: true } : c)),
    )
  }, [])

  const salvarTransacao = useCallback((t: Transacao) => {
    setTransacoes((atual) => {
      const lista = upsert(atual, t.id ? t : { ...t, id: novoId('tr') })
      return [...lista].sort((a, b) => b.data.localeCompare(a.data))
    })
  }, [])

  const removerTransacao = useCallback((id: string) => {
    setTransacoes((atual) => atual.filter((t) => t.id !== id))
  }, [])

  const chamadaDe = useCallback(
    (aulaId: string, data: string) => chamadas.find((c) => c.aulaId === aulaId && c.data === data),
    [chamadas],
  )

  const valor = useMemo<Store>(
    () => ({
      alunos, planos, aulas, chamadas, transacoes,
      salvarAluno, removerAluno, salvarPlano, alternarPlano, salvarAula, removerAula,
      marcarPresenca, fecharChamada, chamadaDe, salvarTransacao, removerTransacao,
    }),
    [
      alunos, planos, aulas, chamadas, transacoes,
      salvarAluno, removerAluno, salvarPlano, alternarPlano, salvarAula, removerAula,
      marcarPresenca, fecharChamada, chamadaDe, salvarTransacao, removerTransacao,
    ],
  )

  return <StoreCtx.Provider value={valor}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore precisa estar dentro de <StoreProvider>')
  return ctx
}
