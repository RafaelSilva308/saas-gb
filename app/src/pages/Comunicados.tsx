import { useState } from 'react'
import { Megaphone, Pin, Plus, Trash2, Users } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, Switch, Textarea } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { AccentBanner, EmptyState, PageHeader } from '@/components/ui/Misc'
import { useStore } from '@/app/store'
import { useAuth } from '@/app/auth'
import { TURMAS, turmaPorId } from '@/data/mock'
import { dataLonga } from '@/lib/format'
import type { Comunicado } from '@/types'
import { cn } from '@/lib/cn'

const DESTINOS = {
  todos: 'Todos os alunos',
  turma: 'Uma turma específica',
  inadimplentes: 'Alunos com mensalidade em aberto',
} as const

export function Comunicados() {
  const { comunicados, alunos, salvarComunicado, removerComunicado } = useStore()
  const { usuario } = useAuth()
  const podeEscrever = usuario?.papel !== 'aluno'

  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState<Comunicado>({
    id: '',
    titulo: '',
    corpo: '',
    autor: usuario?.nome ?? '',
    data: new Date().toISOString().slice(0, 10),
    destino: 'todos',
    fixado: false,
  })

  const ordenados = [...comunicados].sort(
    (a, b) => Number(b.fixado) - Number(a.fixado) || b.data.localeCompare(a.data),
  )

  const alcance = (c: Comunicado) => {
    if (c.destino === 'inadimplentes') return alunos.filter((a) => a.statusPagamento === 'atrasado').length
    if (c.destino === 'turma') return alunos.filter((a) => a.status === 'ativo').length // proxy no protótipo
    return alunos.filter((a) => a.status !== 'inativo').length
  }

  const abrir = () => {
    setDados({
      id: '',
      titulo: '',
      corpo: '',
      autor: usuario?.nome ?? '',
      data: new Date().toISOString().slice(0, 10),
      destino: 'todos',
      fixado: false,
    })
    setErro('')
    setAberto(true)
  }

  const submeter = () => {
    if (dados.titulo.trim().length < 5) return setErro('Escreva um título claro e curto.')
    if (dados.corpo.trim().length < 20) return setErro('O comunicado precisa de um texto com mais contexto.')
    salvarComunicado(dados)
    setAberto(false)
  }

  return (
    <>
      <PageHeader
        titulo="Comunicados"
        subtitulo="Avisos para alunos e responsáveis — mudanças de horário, exames e eventos da academia."
        acoes={
          podeEscrever ? (
            <Button variante="primaria" onClick={abrir}>
              <Plus className="size-4" />
              Enviar comunicado
            </Button>
          ) : undefined
        }
      />

      {podeEscrever && (
        <div className="mb-4">
          <AccentBanner
            titulo="Comunicação que aproxima"
            texto="Um aviso curto e direto, enviado no momento certo, mantém a turma conectada e reduz faltas."
            acao={
              <Button variante="contorno" onClick={abrir} className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                Escrever agora
              </Button>
            }
          />
        </div>
      )}

      {ordenados.length === 0 ? (
        <Card>
          <EmptyState
            icone={<Megaphone className="size-6" />}
            titulo="Nenhum comunicado"
            mensagem="Quando você enviar um aviso, ele aparece aqui e no aplicativo dos alunos."
            acao={
              podeEscrever ? (
                <Button variante="secundaria" onClick={abrir}>
                  <Plus className="size-4" />
                  Enviar comunicado
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {ordenados.map((c) => (
            <Card key={c.id} className={cn(c.fixado && 'ring-1 ring-gb-blue-100')}>
              <CardHeader
                titulo={c.titulo}
                descricao={`${c.autor} · ${dataLonga(c.data)}`}
                acao={
                  <div className="flex shrink-0 items-center gap-1.5">
                    {c.fixado && (
                      <Badge tom="azul">
                        <Pin className="size-3" />
                        Fixado
                      </Badge>
                    )}
                    {podeEscrever && (
                      <button
                        onClick={() => removerComunicado(c.id)}
                        aria-label={`Remover ${c.titulo}`}
                        className="cursor-pointer rounded-md p-1.5 text-gb-gray-500 hover:bg-gb-red-50 hover:text-gb-red-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                }
              />
              <CardBody>
                <p className="text-sm leading-relaxed text-gb-gray-700">{c.corpo}</p>
              </CardBody>
              <footer className="flex flex-wrap items-center gap-3 border-t border-gb-gray-200 bg-gb-gray-50 px-5 py-3">
                <Badge tom="neutro">
                  <Users className="size-3.5" />
                  {c.destino === 'turma' ? turmaPorId(c.turmaId ?? '')?.nome ?? 'Turma' : DESTINOS[c.destino]}
                </Badge>
                <span className="text-xs text-gb-gray-500">Alcance estimado: {alcance(c)} pessoas</span>
              </footer>
            </Card>
          ))}
        </div>
      )}

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Enviar comunicado"
        descricao="Fale de forma direta e acolhedora. Evite textos longos e tom punitivo."
        rodape={
          <>
            <Button variante="fantasma" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button variante="primaria" onClick={submeter}>
              Enviar comunicado
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Título"
            value={dados.titulo}
            onChange={(e) => setDados({ ...dados, titulo: e.target.value })}
            placeholder="Ex.: Exame de graduação — inscrições abertas"
            hint="Um título curto que já entrega a informação principal."
          />
          <Textarea
            label="Mensagem"
            value={dados.corpo}
            onChange={(e) => setDados({ ...dados, corpo: e.target.value })}
            rows={6}
            placeholder="Conte o quê, quando, onde e o que o aluno precisa fazer."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Destinatários"
              value={dados.destino}
              onChange={(e) => setDados({ ...dados, destino: e.target.value as Comunicado['destino'] })}
            >
              {Object.entries(DESTINOS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            {dados.destino === 'turma' && (
              <Select
                label="Turma"
                value={dados.turmaId ?? TURMAS[0].id}
                onChange={(e) => setDados({ ...dados, turmaId: e.target.value })}
              >
                {TURMAS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="border-t border-gb-gray-200 pt-2">
            <Switch
              checked={dados.fixado}
              onChange={(v) => setDados({ ...dados, fixado: v })}
              label="Fixar no topo"
              descricao="Comunicados fixados aparecem primeiro para todos os alunos."
            />
          </div>

          {erro && (
            <p role="alert" className="rounded-md border border-gb-red-100 bg-gb-red-50 px-3 py-2 text-sm font-medium text-gb-red-700">
              {erro}
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
