import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CheckCheck, ClipboardCheck, Lock, Minus, Search, X } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Badge, FaixaBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, PageHeader, Progress } from '@/components/ui/Misc'
import { useStore } from '@/app/store'
import { turmaPorId } from '@/data/mock'
import { DIAS_SEMANA_LONGO, dataLonga } from '@/lib/format'
import type { StatusPresenca } from '@/types'
import { cn } from '@/lib/cn'

const OPCOES: { id: StatusPresenca; label: string; Icone: typeof Check; classe: string }[] = [
  { id: 'presente', label: 'Presente', Icone: Check, classe: 'bg-gb-success text-white border-gb-success' },
  { id: 'justificado', label: 'Justificado', Icone: Minus, classe: 'bg-gb-warn text-white border-gb-warn' },
  { id: 'ausente', label: 'Ausente', Icone: X, classe: 'bg-gb-red-600 text-white border-gb-red-600' },
]

export function Presenca() {
  const { alunos, aulas, chamadaDe, marcarPresenca, fecharChamada } = useStore()

  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [busca, setBusca] = useState('')

  const diaSemana = new Date(data + 'T12:00:00').getDay()
  const aulasDoDia = useMemo(
    () => aulas.filter((a) => a.diaSemana === diaSemana).sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [aulas, diaSemana],
  )

  const [aulaId, setAulaId] = useState('')
  const aulaSelecionada = aulasDoDia.find((a) => a.id === aulaId) ?? aulasDoDia[0]

  const chamada = aulaSelecionada ? chamadaDe(aulaSelecionada.id, data) : undefined

  /* Elegíveis: turmas infantis mostram só alunos com responsável cadastrado. */
  const elegiveis = useMemo(() => {
    if (!aulaSelecionada) return []
    const infantil = ['t3', 't4'].includes(aulaSelecionada.turmaId)
    const q = busca.trim().toLowerCase()
    return alunos
      .filter((a) => a.status !== 'inativo')
      .filter((a) => (infantil ? !!a.responsavel : !a.responsavel))
      .filter((a) => !q || a.nome.toLowerCase().includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [alunos, aulaSelecionada, busca])

  const statusDe = (alunoId: string): StatusPresenca | undefined =>
    chamada?.registros.find((r) => r.alunoId === alunoId)?.status

  const presentes = elegiveis.filter((a) => statusDe(a.id) === 'presente').length
  const marcados = elegiveis.filter((a) => statusDe(a.id) !== undefined).length
  const ocupacao = aulaSelecionada ? Math.round((presentes / aulaSelecionada.capacidade) * 100) : 0
  const fechada = chamada?.fechada ?? false

  const marcarTodos = (status: StatusPresenca) => {
    if (!aulaSelecionada || fechada) return
    for (const a of elegiveis) marcarPresenca(aulaSelecionada.id, data, a.id, status)
  }

  return (
    <>
      <PageHeader
        titulo="Controle de presença"
        subtitulo="Faça a chamada da turma. Um toque por aluno — o registro entra no histórico na hora."
        acoes={
          aulaSelecionada && !fechada ? (
            <>
              <Button variante="contorno" onClick={() => marcarTodos('presente')}>
                <CheckCheck className="size-4" />
                Marcar todos
              </Button>
              <Button
                variante="primaria"
                onClick={() => fecharChamada(aulaSelecionada.id, data)}
                disabled={marcados === 0}
              >
                <Lock className="size-4" />
                Fechar chamada
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Seleção de dia e aula */}
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-end gap-3">
          <Input
            label="Data"
            type="date"
            value={data}
            onChange={(e) => {
              setData(e.target.value)
              setAulaId('')
            }}
            wrapClass="w-full sm:w-44"
          />
          <Select
            label="Aula"
            value={aulaSelecionada?.id ?? ''}
            onChange={(e) => setAulaId(e.target.value)}
            wrapClass="w-full sm:min-w-[240px] sm:flex-1"
            disabled={aulasDoDia.length === 0}
          >
            {aulasDoDia.length === 0 && <option>Sem aulas neste dia</option>}
            {aulasDoDia.map((a) => (
              <option key={a.id} value={a.id}>
                {a.inicio} — {a.titulo} ({turmaPorId(a.turmaId)?.nome})
              </option>
            ))}
          </Select>
          <Input
            label="Buscar aluno"
            placeholder="Nome do aluno"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            iconeEsq={<Search className="size-4" />}
            wrapClass="w-full sm:min-w-[200px] sm:flex-1"
          />
        </CardBody>
      </Card>

      {!aulaSelecionada ? (
        <Card>
          <EmptyState
            icone={<ClipboardCheck className="size-6" />}
            titulo={`Nenhuma aula na ${DIAS_SEMANA_LONGO[diaSemana].toLowerCase()}`}
            mensagem="Escolha outra data ou inclua a aula no quadro de horários."
            acao={
              <Link to="/agenda">
                <Button variante="secundaria">Ver agenda</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {/* Resumo da chamada */}
          <Card className="lg:col-span-1 lg:order-2 lg:sticky lg:top-20 lg:self-start">
            <CardHeader titulo="Resumo" descricao={dataLonga(data)} />
            <CardBody className="space-y-4">
              <div>
                <p className="gb-label">{aulaSelecionada.titulo}</p>
                <p className="mt-1 text-sm text-gb-gray-700">
                  {turmaPorId(aulaSelecionada.turmaId)?.nome} · {aulaSelecionada.inicio}–{aulaSelecionada.fim}
                </p>
                <p className="text-sm text-gb-gray-500">{aulaSelecionada.local}</p>
              </div>

              <div className="border-t border-gb-gray-200 pt-4">
                <p className="gb-metric text-gb-ink">
                  {presentes}
                  <span className="text-lg text-gb-gray-500">/{aulaSelecionada.capacidade}</span>
                </p>
                <p className="mt-1 text-xs text-gb-gray-500">presentes · {ocupacao}% da capacidade</p>
                <Progress
                  valor={ocupacao}
                  className="mt-2"
                  cor={ocupacao > 90 ? 'var(--color-gb-red-600)' : 'var(--color-gb-blue-600)'}
                />
              </div>

              <dl className="grid grid-cols-3 gap-2 border-t border-gb-gray-200 pt-4 text-center">
                {[
                  ['Presentes', presentes],
                  ['Justificados', elegiveis.filter((a) => statusDe(a.id) === 'justificado').length],
                  ['Ausentes', elegiveis.filter((a) => statusDe(a.id) === 'ausente').length],
                ].map(([label, n]) => (
                  <div key={label as string}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-gb-gray-500">{label}</dt>
                    <dd className="gb-title text-xl text-gb-ink">{n}</dd>
                  </div>
                ))}
              </dl>

              {fechada ? (
                <Badge tom="ok" className="w-full justify-center py-1.5">
                  <Lock className="size-3.5" />
                  Chamada fechada
                </Badge>
              ) : (
                <p className="text-xs leading-relaxed text-gb-gray-500">
                  {marcados} de {elegiveis.length} alunos marcados. Feche a chamada quando terminar — depois disso
                  ela entra no histórico.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Lista de chamada */}
          <Card className="lg:col-span-3 lg:order-1">
            <CardHeader
              titulo="Chamada"
              descricao={`${elegiveis.length} alunos elegíveis para esta turma`}
              acao={
                fechada ? (
                  <Badge tom="neutro">
                    <Lock className="size-3.5" />
                    Somente leitura
                  </Badge>
                ) : undefined
              }
            />
            {elegiveis.length === 0 ? (
              <EmptyState icone={<Search className="size-6" />} titulo="Nenhum aluno" mensagem="Ajuste a busca ou verifique os cadastros da turma." />
            ) : (
              <ul className="divide-y divide-gb-gray-200">
                {elegiveis.map((a) => {
                  const st = statusDe(a.id)
                  return (
                    <li
                      key={a.id}
                      className={cn(
                        'flex flex-wrap items-center gap-3 px-4 py-3 transition-colors sm:px-5',
                        st === 'presente' && 'bg-gb-success-bg/40',
                        st === 'ausente' && 'bg-gb-red-50/50',
                      )}
                    >
                      <Avatar nome={a.nome} />
                      <Link to={`/alunos/${a.id}`} className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gb-ink hover:text-gb-blue-600">
                          {a.nome}
                        </span>
                        <FaixaBadge faixa={a.faixa} compacto />
                      </Link>

                      <span className="hidden shrink-0 text-xs text-gb-gray-500 sm:block">
                        {a.frequencia30d}% em 30d
                      </span>

                      {/* Botões grandes o suficiente para uso no tatame, no celular */}
                      <div className="flex w-full shrink-0 gap-1.5 sm:w-auto">
                        {OPCOES.map(({ id, label, Icone, classe }) => {
                          const ativo = st === id
                          return (
                            <button
                              key={id}
                              onClick={() => !fechada && marcarPresenca(aulaSelecionada.id, data, a.id, id)}
                              disabled={fechada}
                              aria-pressed={ativo}
                              aria-label={`${label}: ${a.nome}`}
                              className={cn(
                                'inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors sm:flex-none',
                                ativo ? classe : 'border-gb-gray-300 bg-white text-gb-gray-500 hover:border-gb-gray-500 hover:text-gb-ink',
                                fechada && 'cursor-not-allowed opacity-60',
                              )}
                            >
                              <Icone className="size-4" />
                              <span className={cn(ativo ? 'inline' : 'hidden sm:inline')}>{label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
