import { useState } from 'react'
import { Building2, Palette, ShieldCheck, Users } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, Switch } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { PageHeader, Tabs } from '@/components/ui/Misc'
import { ROTULO_PAPEL, useAuth } from '@/app/auth'
import { USUARIOS } from '@/data/mock'
import { FAIXAS } from '@/lib/format'

export function Configuracoes() {
  const { usuario } = useAuth()
  const [aba, setAba] = useState<'academia' | 'equipe' | 'notificacoes' | 'marca'>('academia')

  const [notificacoes, setNotificacoes] = useState({
    vencimento: true,
    inadimplencia: true,
    aniversario: false,
    ausencia: true,
    resumoSemanal: true,
  })

  return (
    <>
      <PageHeader
        titulo="Configurações"
        subtitulo="Dados da academia, equipe, avisos automáticos e identidade visual do sistema."
      />

      <div className="mb-4">
        <Tabs
          valor={aba}
          aoMudar={setAba}
          itens={[
            { id: 'academia', label: 'Academia' },
            { id: 'equipe', label: 'Equipe e acessos' },
            { id: 'notificacoes', label: 'Avisos automáticos' },
            { id: 'marca', label: 'Identidade visual' },
          ]}
        />
      </div>

      {aba === 'academia' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader titulo="Dados da academia" descricao="Aparecem em recibos e relatórios" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Input label="Nome da academia" defaultValue="Academia de Jiu-Jitsu — Unidade Centro" wrapClass="sm:col-span-2" />
              <Input label="CNPJ" defaultValue="00.000.000/0001-00" />
              <Input label="Telefone" defaultValue="(11) 3000-0000" />
              <Input label="E-mail de contato" type="email" defaultValue="contato@academia.com.br" />
              <Input label="Responsável técnico" defaultValue="Prof. Carlos Barra" />
              <Input label="Endereço" defaultValue="Rua do Tatame, 100 — Centro" wrapClass="sm:col-span-2" />
              <Select label="Fuso horário" defaultValue="sp">
                <option value="sp">America/Sao_Paulo (GMT-3)</option>
                <option value="mn">America/Manaus (GMT-4)</option>
              </Select>
              <Select label="Moeda" defaultValue="brl">
                <option value="brl">Real (R$)</option>
              </Select>
            </CardBody>
            <footer className="flex justify-end gap-2 border-t border-gb-gray-200 bg-gb-gray-50 px-5 py-4">
              <Button variante="fantasma">Descartar</Button>
              <Button variante="primaria">Salvar alterações</Button>
            </footer>
          </Card>

          <Card>
            <CardHeader titulo="Sua conta" descricao="Perfil usado nesta sessão" />
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar nome={usuario?.nome ?? ''} tamanho="lg" />
                <div className="min-w-0">
                  <p className="truncate font-bold text-gb-ink">{usuario?.nome}</p>
                  <p className="truncate text-sm text-gb-gray-500">{usuario?.email}</p>
                  <Badge tom="azul" className="mt-1.5">
                    {usuario ? ROTULO_PAPEL[usuario.papel] : ''}
                  </Badge>
                </div>
              </div>
              <div className="space-y-3 border-t border-gb-gray-200 pt-4">
                <Input label="Nome de exibição" defaultValue={usuario?.nome} />
                <Input label="E-mail" type="email" defaultValue={usuario?.email} />
                <Button variante="secundaria" className="w-full">
                  Alterar senha
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {aba === 'equipe' && (
        <Card>
          <CardHeader
            titulo="Equipe e permissões"
            descricao="Cada papel enxerga apenas o que precisa para trabalhar"
            acao={<Button variante="secundaria">Convidar pessoa</Button>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-gb-gray-200">
                  {['Pessoa', 'E-mail', 'Papel', 'Acesso', ''].map((h) => (
                    <th key={h} className="gb-label px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gb-gray-200">
                {USUARIOS.map((u) => (
                  <tr key={u.id} className="hover:bg-gb-gray-50">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-3">
                        <Avatar nome={u.nome} />
                        <span className="truncate font-semibold text-gb-ink">{u.nome}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gb-gray-700">{u.email}</td>
                    <td className="px-5 py-3">
                      <Badge tom="azul">{ROTULO_PAPEL[u.papel]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-sm text-gb-gray-500">
                      {u.papel === 'gestor'
                        ? 'Tudo, incluindo financeiro'
                        : u.papel === 'professor'
                          ? 'Alunos, agenda e presença'
                          : 'Sua própria ficha e agenda'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variante="fantasma" tamanho="sm">
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <CardBody className="border-t border-gb-gray-200 bg-gb-gray-50">
            <h3 className="gb-title mb-3 flex items-center gap-2 text-base text-gb-ink">
              <ShieldCheck className="size-4 text-gb-blue-600" />
              O que cada papel enxerga
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { Icone: Building2, papel: 'Gestor', desc: 'Indicadores, inadimplência, ocupação de turmas, planos e financeiro completo.' },
                { Icone: Users, papel: 'Professor', desc: 'Chamada, organização das turmas, observações de treino e acompanhamento individual.' },
                { Icone: Palette, papel: 'Aluno', desc: 'Calendário, presença, evolução de faixa e próximos objetivos.' },
              ].map(({ Icone, papel, desc }) => (
                <div key={papel} className="rounded-md border border-gb-gray-200 bg-white p-4">
                  <p className="flex items-center gap-2 font-bold text-gb-ink">
                    <Icone className="size-4 text-gb-blue-600" />
                    {papel}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-gb-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {aba === 'notificacoes' && (
        <Card className="max-w-3xl">
          <CardHeader titulo="Avisos automáticos" descricao="O sistema envia esses lembretes sem que você precise lembrar" />
          <CardBody className="divide-y divide-gb-gray-200">
            <Switch
              checked={notificacoes.vencimento}
              onChange={(v) => setNotificacoes({ ...notificacoes, vencimento: v })}
              label="Lembrete de vencimento"
              descricao="Enviado três dias antes da data de pagamento do aluno."
            />
            <Switch
              checked={notificacoes.inadimplencia}
              onChange={(v) => setNotificacoes({ ...notificacoes, inadimplencia: v })}
              label="Aviso de mensalidade em aberto"
              descricao="Mensagem acolhedora convidando o aluno a regularizar."
            />
            <Switch
              checked={notificacoes.ausencia}
              onChange={(v) => setNotificacoes({ ...notificacoes, ausencia: v })}
              label="Convite para quem sumiu"
              descricao="Enviado a alunos sem presença registrada há 14 dias."
            />
            <Switch
              checked={notificacoes.aniversario}
              onChange={(v) => setNotificacoes({ ...notificacoes, aniversario: v })}
              label="Mensagem de aniversário"
              descricao="Um cumprimento simples da equipe da academia."
            />
            <Switch
              checked={notificacoes.resumoSemanal}
              onChange={(v) => setNotificacoes({ ...notificacoes, resumoSemanal: v })}
              label="Resumo semanal para o professor"
              descricao="Presença, novas matrículas e pendências da semana, toda segunda de manhã."
            />
          </CardBody>
          <footer className="flex justify-end gap-2 border-t border-gb-gray-200 bg-gb-gray-50 px-5 py-4">
            <Button variante="primaria">Salvar preferências</Button>
          </footer>
        </Card>
      )}

      {aba === 'marca' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader titulo="Paleta do sistema" descricao="Vermelho para ação, azul para estrutura, neutros para leitura" />
            <CardBody className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Vermelho', '#d40000', 'CTA e urgência'],
                  ['Azul', '#1764a8', 'Navegação e confiança'],
                  ['Branco', '#ffffff', 'Fundo e cartões'],
                  ['Preto', '#111111', 'Títulos e números'],
                ].map(([nome, hex, uso]) => (
                  <div key={nome}>
                    <div className="h-20 rounded-md border border-gb-gray-200" style={{ background: hex }} />
                    <p className="mt-2 text-sm font-bold text-gb-ink">{nome}</p>
                    <p className="font-mono text-xs text-gb-gray-500">{hex}</p>
                    <p className="mt-0.5 text-xs text-gb-gray-500">{uso}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Cinza claro', '#f2f4f6'],
                  ['Cinza médio', '#667085'],
                  ['Borda', '#e4e8ed'],
                ].map(([nome, hex]) => (
                  <div key={nome}>
                    <div className="h-12 rounded-md border border-gb-gray-200" style={{ background: hex }} />
                    <p className="mt-1.5 text-xs font-semibold text-gb-ink">{nome}</p>
                    <p className="font-mono text-[10px] text-gb-gray-500">{hex}</p>
                  </div>
                ))}
              </div>
              <p className="rounded-md border border-gb-blue-100 bg-gb-blue-50 p-3 text-xs leading-relaxed text-gb-gray-700">
                Estes valores são <strong>aproximações para prototipação</strong>. Antes de publicar, confirme os
                arquivos oficiais de marca e as regras de uso com a liderança da rede.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Tipografia e faixas" descricao="Títulos condensados, corpo neutro, cores de faixa com legenda" />
            <CardBody className="space-y-6">
              <div>
                <p className="gb-label mb-2">Título principal</p>
                <p className="gb-title text-4xl text-gb-ink">Gestão que fortalece</p>
                <p className="gb-label mt-4 mb-1">Título secundário</p>
                <p className="gb-title text-xl text-gb-ink">Turmas e horários</p>
                <p className="gb-label mt-4 mb-1">Texto de apoio</p>
                <p className="max-w-md text-sm leading-relaxed text-gb-gray-700">
                  Texto de parágrafo com boa legibilidade para leitura contínua em telas de escritório e celular.
                </p>
                <p className="gb-label mt-4 mb-1">Números e destaques</p>
                <p className="gb-metric text-gb-blue-600">12345</p>
              </div>

              <div className="border-t border-gb-gray-200 pt-4">
                <p className="gb-label mb-3">Cores de faixa</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(FAIXAS).map(([k, f]) => (
                    <span
                      key={k}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gb-gray-200 px-2.5 py-1 text-xs font-semibold"
                    >
                      <span aria-hidden className="size-3 rounded-full border border-black/15" style={{ background: f.cor }} />
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  )
}
