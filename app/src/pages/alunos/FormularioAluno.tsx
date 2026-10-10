import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { useStore } from '@/app/store'
import { FAIXAS } from '@/lib/format'
import type { Aluno, Faixa, StatusAluno, StatusPagamento } from '@/types'

const VAZIO: Aluno = {
  id: '',
  nome: '',
  email: '',
  telefone: '',
  nascimento: '',
  faixa: 'branca',
  graus: 0,
  status: 'experimental',
  matriculaEm: new Date().toISOString().slice(0, 10),
  planoId: 'p1',
  vencimentoDia: 10,
  statusPagamento: 'em_dia',
  frequencia30d: 0,
}

type Erros = Partial<Record<'nome' | 'email' | 'telefone' | 'nascimento', string>>

export function FormularioAluno({
  aberto,
  aluno,
  aoFechar,
}: {
  aberto: boolean
  aluno: Aluno | null
  aoFechar: () => void
}) {
  const { planos, salvarAluno, removerAluno } = useStore()
  const [dados, setDados] = useState<Aluno>(VAZIO)
  const [erros, setErros] = useState<Erros>({})
  const [temResponsavel, setTemResponsavel] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setDados(aluno ?? VAZIO)
    setTemResponsavel(!!aluno?.responsavel)
    setErros({})
  }, [aberto, aluno])

  const set = <K extends keyof Aluno,>(chave: K, valor: Aluno[K]) =>
    setDados((d) => ({ ...d, [chave]: valor }))

  const validar = (): boolean => {
    const e: Erros = {}
    if (dados.nome.trim().length < 3) e.nome = 'Informe o nome completo do aluno.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) e.email = 'Informe um e-mail válido.'
    if (dados.telefone.replace(/\D/g, '').length < 10) e.telefone = 'Informe telefone com DDD.'
    if (!dados.nascimento) e.nascimento = 'Informe a data de nascimento.'
    setErros(e)
    return Object.keys(e).length === 0
  }

  const submeter = () => {
    if (!validar()) return
    salvarAluno({ ...dados, responsavel: temResponsavel ? dados.responsavel ?? { nome: '', telefone: '' } : undefined })
    aoFechar()
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={aluno ? 'Editar aluno' : 'Adicionar aluno'}
      descricao={
        aluno
          ? 'Atualize os dados cadastrais, o plano e a situação do aluno.'
          : 'Preencha os dados básicos. Você pode completar o cadastro depois.'
      }
      rodape={
        <>
          {aluno && (
            <Button
              variante="perigo"
              className="mr-auto"
              onClick={() => {
                removerAluno(aluno.id)
                aoFechar()
              }}
            >
              Remover cadastro
            </Button>
          )}
          <Button variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button variante="primaria" onClick={submeter}>
            {aluno ? 'Salvar alterações' : 'Cadastrar aluno'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submeter()
        }}
        className="space-y-6"
      >
        <fieldset className="space-y-4">
          <legend className="rs-label mb-2">Dados pessoais</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome completo"
              value={dados.nome}
              onChange={(e) => set('nome', e.target.value)}
              erro={erros.nome}
              wrapClass="sm:col-span-2"
              placeholder="Ex.: Maria Santos"
            />
            <Input
              label="E-mail"
              type="email"
              value={dados.email}
              onChange={(e) => set('email', e.target.value)}
              erro={erros.email}
              placeholder="maria@email.com"
            />
            <Input
              label="Telefone"
              value={dados.telefone}
              onChange={(e) => set('telefone', e.target.value)}
              erro={erros.telefone}
              placeholder="(11) 99999-0000"
            />
            <Input
              label="Data de nascimento"
              type="date"
              value={dados.nascimento}
              onChange={(e) => set('nascimento', e.target.value)}
              erro={erros.nascimento}
            />
            <Input
              label="Matriculado em"
              type="date"
              value={dados.matriculaEm}
              onChange={(e) => set('matriculaEm', e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="rs-label mb-2">Graduação e situação</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Faixa" value={dados.faixa} onChange={(e) => set('faixa', e.target.value as Faixa)}>
              {Object.entries(FAIXAS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
            <Select label="Graus" value={dados.graus} onChange={(e) => set('graus', Number(e.target.value))}>
              {[0, 1, 2, 3, 4].map((g) => (
                <option key={g} value={g}>
                  {g === 0 ? 'Sem graus' : `${g}º grau${g > 1 ? 's' : ''}`}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              value={dados.status}
              onChange={(e) => set('status', e.target.value as StatusAluno)}
            >
              <option value="ativo">Ativo</option>
              <option value="experimental">Experimental</option>
              <option value="inativo">Inativo</option>
            </Select>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="rs-label mb-2">Plano e cobrança</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Plano" value={dados.planoId} onChange={(e) => set('planoId', e.target.value)}>
              {planos
                .filter((p) => p.ativo || p.id === dados.planoId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </Select>
            <Select
              label="Dia de vencimento"
              value={dados.vencimentoDia}
              onChange={(e) => set('vencimentoDia', Number(e.target.value))}
            >
              {[5, 10, 15, 20, 25].map((d) => (
                <option key={d} value={d}>
                  Dia {d}
                </option>
              ))}
            </Select>
            <Select
              label="Situação do pagamento"
              value={dados.statusPagamento}
              onChange={(e) => set('statusPagamento', e.target.value as StatusPagamento)}
            >
              <option value="em_dia">Em dia</option>
              <option value="vence_em_breve">Vence em breve</option>
              <option value="atrasado">Atrasado</option>
            </Select>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="rs-label mb-2">Responsável</legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-rs-gray-700">
            <input
              type="checkbox"
              checked={temResponsavel}
              onChange={(e) => setTemResponsavel(e.target.checked)}
              className="size-4 cursor-pointer accent-rs-blue-600"
            />
            Aluno menor de idade com responsável
          </label>
          {temResponsavel && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nome do responsável"
                value={dados.responsavel?.nome ?? ''}
                onChange={(e) =>
                  set('responsavel', { nome: e.target.value, telefone: dados.responsavel?.telefone ?? '' })
                }
              />
              <Input
                label="Telefone do responsável"
                value={dados.responsavel?.telefone ?? ''}
                onChange={(e) =>
                  set('responsavel', { nome: dados.responsavel?.nome ?? '', telefone: e.target.value })
                }
              />
            </div>
          )}
        </fieldset>

        <Textarea
          label="Observações de treino"
          hint="Lesões, restrições ou pontos de atenção que o professor precisa lembrar."
          value={dados.observacoes ?? ''}
          onChange={(e) => set('observacoes', e.target.value)}
          placeholder="Ex.: recuperando lesão no ombro, evitar quedas por 30 dias."
        />
      </form>
    </Modal>
  )
}
