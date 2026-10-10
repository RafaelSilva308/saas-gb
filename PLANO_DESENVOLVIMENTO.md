# Plano de desenvolvimento — REDSHIELD, gestão da academia

> **Ordem de execução, decisões pendentes, modelo do banco e custos:** veja [`ROADMAP.md`](./ROADMAP.md).
> Onde este documento e o `ROADMAP.md` divergirem, vale o `ROADMAP.md`.

> ## ⚠️ Atualização de produto — presença por check-in (supera o que está abaixo)
>
> Decisão do dono do produto, posterior à redação deste plano. **Onde as seções 1 a 10 falarem em "chamada feita pelo professor",
> "fechar chamada" ou "marcar todos", vale o que está aqui:**
>
> 1. **Não existe chamada do professor.** Quem registra a presença é o **aluno**, pelo celular, com o **check-in** na aula do dia.
> 2. Fez check-in = **presente na hora**. O professor **não precisa** marcar nem confirmar.
> 3. **Quem não fez check-in tem falta** — a presença não é computada. A falta não é gravada: é a ausência do registro.
> 4. O **professor tem liberdade total para editar**: marcar presente, falta (e, se mantido, justificado) para qualquer aluno e aula, inclusive de dias anteriores.
>    Uma correção do professor passa a valer no lugar do check-in e o aluno não a altera mais. Toda correção é auditada.
> 5. O **aluno passa a ter login na v1** (papel `aluno`), com Painel, Agenda, Progresso e Check-in.
> 6. O risco de fraude (marcar de casa ou por um colega) foi **aceito** para a v1. Endurecimento futuro (janela de horário, QR code, geolocalização,
>    confirmação do professor) está no `ROADMAP.md`; o banco já grava a origem de cada presença.
>
> Efeitos neste documento, já ajustados abaixo: modelo de dados (`chamada`, `presenca`), contrato de API (endpoints de chamada → check-in e correção),
> fluxos E2E, perfis de uso e glossário. **Decisões que ainda dependem da academia:** prazo para o check-in e para a correção (E16), se "justificado" continua (E17),
> alunos sem celular, crianças e quem não faz check-in (E14/E15). Detalhes e modelo SQL testado: `ROADMAP.md`, `BANCO_DE_DADOS.md`, `db/schema.sql`.

Documento de referência do projeto. Descreve **o que já existe**, **como continuar** e
**como o back-end deve ser construído** quando o front-end estiver aprovado.

- **Fase 1 — Front-end (concluída, aguardando validação):** interface completa navegável com dados simulados.
- **Fase 2 — Back-end:** só começa depois que o professor validar as telas. Mudar tela é barato agora; será caro depois que houver banco, API e dados reais.

---

## 1. Visão do produto

### 1.1 Problema

O professor administra a academia entre planilhas, caderno de chamada, conversas de WhatsApp e memória.
As perguntas que ele não consegue responder rápido são sempre as mesmas:

- Quantos alunos estão realmente ativos?
- Quem está com a mensalidade em aberto?
- Quem sumiu do tatame nas últimas semanas?
- A turma das 19h está cheia ou vazia?
- Quem já pode ser avaliado para a próxima graduação?
- O mês fechou no positivo?

### 1.2 Princípio de produto

> Transformar a experiência da academia em uma jornada clara de evolução, pertencimento e organização.

O sistema deve **reduzir a ansiedade operacional do professor**: menos enfeite, mais previsibilidade,
status claros e caminhos curtos para as tarefas do dia.

### 1.3 Perfis de uso

| Perfil | O que ele precisa | Prioridade na interface |
|---|---|---|
| **Gestor** (dono) | Indicadores, inadimplência, ocupação, retenção, resultado do mês | Painel, Financeiro, Planos |
| **Professor** | Conferir e corrigir presenças (os alunos fazem check-in), organização das turmas, observações de treino, acompanhamento individual | Presença, Agenda, Alunos |
| **Aluno / responsável** | Fazer check-in na aula, calendário, presença, evolução de faixa, próximos objetivos | Check-in, Painel do aluno, Agenda, Progresso |

---

## 2. Escopo do MVP

Oito blocos, na ordem em que agregam valor:

| # | Bloco | Estado | Onde está |
|---|---|---|---|
| 1 | Login e controle de acesso | ✅ Front-end pronto | `src/pages/Entrar.tsx`, `src/app/auth.tsx` |
| 2 | Painel com indicadores principais | ✅ Front-end pronto | `src/pages/Painel.tsx` |
| 3 | Cadastro e edição de alunos | ✅ Front-end pronto | `src/pages/Alunos.tsx`, `AlunoDetalhe.tsx` |
| 4 | Planos e vencimentos | ✅ Front-end pronto | `src/pages/Planos.tsx` |
| 5 | Receitas e despesas | ✅ Front-end pronto | `src/pages/Financeiro.tsx` |
| 6 | Presença por check-in do aluno, com correção pelo professor | ✅ Front-end pronto (protótipo) | `src/pages/Checkin.tsx`, `src/pages/Presenca.tsx` |
| 7 | Agenda de aulas | ✅ Front-end pronto | `src/pages/Agenda.tsx` |
| 8 | Progresso de faixas | ✅ Front-end pronto | `src/pages/Progresso.tsx` |

**Fora do MVP** (registrado para não virar escopo escondido): app nativo, gateway de pagamento com
cobrança automática, catraca/QR code de entrada, loja online, multi-unidade (rede de academias),
relatórios fiscais e emissão de nota.

---

## 3. Identidade visual aplicada

Base: `redshield_guia_identidade_visual.md` + `referencia_visual_conceitual.png`.

> ⚠️ **Identidade visual provisória.** As cores, a tipografia e o símbolo atuais são aproximações para prototipação,
> **não** a identidade oficial do REDSHIELD. Se a academia tiver logotipo e manual de marca, eles substituem o que está aqui.
> O símbolo atual (`src/components/Logo.tsx`) é um escudo simples e provisório. A imagem `referencia_visual_conceitual.png`
> traz um símbolo e fotos que **não** são do REDSHIELD e não devem ser publicados.

### 3.1 Sistema de cor (funcional, não decorativo)

| Papel | Token | Valor | Uso |
|---|---|---|---|
| Ação / urgência | `rs-red-600` | `#d40000` | CTA principal, alertas críticos. **Um por tela.** |
| Estrutura / confiança | `rs-blue-600` | `#1764a8` | Navegação, cabeçalho, links, estados ativos |
| Superfície | `white` / `rs-gray-100` | `#ffffff` / `#f2f4f6` | Cartões sobre fundo cinza claro |
| Texto forte | `rs-ink` | `#111111` | Títulos, números, ícones fortes |
| Texto auxiliar | `rs-gray-500` | `#667085` | Metadados, labels, informação secundária |
| Confirmação | `rs-success` | `#12805c` | Presença registrada, pagamento em dia |
| Atenção | `rs-warn` | `#b25e09` | Vence em breve, justificado |

Regra que o código segue: **nenhum estado depende só de cor**. Todo badge carrega rótulo textual,
toda faixa tem legenda, todo gráfico tem eixo e tooltip.

### 3.2 Tipografia

- **Títulos:** Barlow Condensed 700, caixa alta — classe `.rs-title`.
- **Corpo:** Inter 400/500/600.
- **Números de métrica:** `.rs-metric` (condensada, 2.5rem).
- **Labels:** `.rs-label` (11px, caixa alta, tracking largo, cinza médio).

### 3.3 Geometria diagonal

Usada **só em momentos de destaque**: painel institucional do login, cartão da próxima aula
e destaques de graduação. Classe `.rs-diagonal` + polígonos SVG abstratos. O resto do produto é limpo.

---

## 4. Arquitetura do front-end (Fase 1 — entregue)

### 4.1 Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Build | Vite 8 | Dev server instantâneo, build enxuto |
| UI | React 19 + TypeScript (strict) | Tipagem do domínio pega erro antes do runtime |
| Estilo | Tailwind CSS v4 (`@theme`) | Tokens de marca centralizados em um arquivo |
| Rotas | React Router (HashRouter) | Funciona em hospedagem estática sem servidor |
| Gráficos | Recharts | Carregado sob demanda, só nas telas que usam |
| Ícones | lucide-react | Traço linear, coerente com o guia |

### 4.2 Estrutura de pastas

```
app/
├── public/favicon.svg
└── src/
    ├── app/
    │   ├── auth.tsx           # sessão simulada + papéis (troca por API na Fase 2)
    │   └── store.tsx          # estado em memória; cada função = 1 endpoint futuro
    ├── components/
    │   ├── Logo.tsx           # símbolo provisório (escudo)
    │   ├── layout/            # Sidebar, Topbar, AppLayout, guarda por papel
    │   └── ui/                # Button, Card, Badge, Field, Modal, StatCard, Misc
    ├── data/
    │   ├── mock.ts            # dados simulados determinísticos
    │   └── selectors.ts       # cálculos derivados (viram /metrics no back-end)
    ├── lib/                   # format.ts (pt-BR, faixas, status), cn.ts
    ├── pages/                 # uma pasta = um bloco do MVP
    ├── types/index.ts         # ⭐ contrato de domínio — o back-end honra estes tipos
    ├── App.tsx                # rotas + code splitting
    └── index.css              # design tokens (@theme) + classes de marca
```

### 4.3 O ponto de costura com o back-end

Toda a mutação de dados passa por **`src/app/store.tsx`**. Ele expõe funções (`salvarAluno`,
`marcarPresenca`, `fecharChamada`, `salvarTransacao`…) que hoje mexem em estado React e amanhã
viram chamadas HTTP. **Trocar esse arquivo por TanStack Query + `fetch` é praticamente toda a
integração do front com a API.** Nenhuma página importa `mock.ts` para escrever — só para ler
catálogos estáticos (turmas).

### 4.4 Responsividade

Estratégia mobile-first com breakpoints Tailwind (`sm` 640 / `lg` 1024 / `xl` 1280):

- **< 1024px:** sidebar vira gaveta com overlay; topbar ganha botão de menu.
- **< 640px:** ações do cabeçalho ocupam a largura toda e dividem o espaço; filtros viram meia-largura; modais viram *bottom sheet*; abas rolam horizontalmente sem barra visível.
- **Tabelas:** sempre dentro de `overflow-x-auto` com `min-w`, para o corpo da página nunca rolar na horizontal.
- **Check-in (aluno) e correção (professor):** o botão "Fazer check-in" ocupa a largura do cartão no celular; na tela do professor, Presente/Justificado/Falta têm 40px de altura, para uso com o dedo.
- **Gráficos:** `ResponsiveContainer`, sem largura fixa.

### 4.5 Acessibilidade

- Foco sempre visível (`:focus-visible` com contorno azul).
- `aria-label` em ícones-botão, `aria-pressed` em alternadores, `role="switch"`, `role="progressbar"`, `role="alert"` em erros de formulário.
- Contraste conferido em texto sobre vermelho, azul e cinza.
- Modal com trava de rolagem, foco inicial e fechamento por `Esc`.

### 4.6 Como rodar

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
npm run preview  # serve o build
```

**Acessos de demonstração** (senha `treino123` para todos):

| E-mail | Papel | Enxerga |
|---|---|---|
| `gestor@redshield.com.br` | Gestor | Tudo, incluindo Financeiro e Planos |
| `professor@redshield.com.br` | Professor | Alunos, Agenda, Presença, Progresso |
| `aluno@redshield.com.br` | Aluno | Painel, Agenda, Progresso, Check-in |

---

## 5. Checklist de validação da Fase 1

Antes de escrever uma linha de back-end, percorrer com o professor:

- [ ] Os quatro indicadores do painel são os certos? Falta algum? Sobra algum?
- [ ] A ordem das telas na navegação lateral bate com a rotina do dia?
- [ ] O check-in do aluno funciona com o celular na mão, na porta do tatame? O professor consegue conferir e corrigir as presenças rápido?
- [ ] Os campos do cadastro de aluno são suficientes? (Falta CPF? Endereço? Convênio? Foto?)
- [ ] Os planos refletem o que a academia vende hoje?
- [ ] As categorias de receita e despesa são as que ele usa?
- [ ] O critério de "elegível à graduação" é o critério real da academia?
- [ ] Os textos soam como a academia fala? (Nada punitivo, nada técnico demais.)
- [ ] O que ele faz **todo dia** está a no máximo dois cliques do painel?

**Só depois de todos marcados a Fase 2 começa.**

---

## 6. Fase 2 — Back-end

### 6.1 Stack recomendada

| Camada | Escolha | Motivo |
|---|---|---|
| Runtime | Node.js 22 + TypeScript | Mesma linguagem do front; os tipos de `src/types` são reaproveitados literalmente |
| Framework | Fastify | Rápido, validação por schema nativa, ótimo suporte a TS |
| Banco | PostgreSQL | Relacional é o modelo certo aqui (aluno → plano → cobrança → presença) |
| ORM | Prisma | Migrations versionadas, tipos gerados, legível para quem for manter depois |
| Auth | JWT curto + refresh em cookie `httpOnly` | Sem token no `localStorage` |
| Validação | Zod | Mesmo schema valida requisição no servidor e formulário no cliente |
| Arquivos | S3 / Cloudflare R2 | Fotos de aluno |
| Fila / agendamento | pg-boss ou node-cron | Lembretes de vencimento, resumo semanal |
| Testes | Vitest + Supertest | Mesmo runner do front |
| Observabilidade | Pino + Sentry | Log estruturado, erro rastreado |

> **Decisão atual (ver `ROADMAP.md`, D8–D10):** Neon (PostgreSQL) + Fastify na Railway, com o front servido pela API. A Supabase fica como alternativa.
> Reduz muito o tempo até o primeiro deploy. O custo é ficar mais acoplado ao fornecedor — aceitável
> para uma academia, revisável se o produto virar rede.

### 6.2 Modelo de dados

Deriva direto de `app/src/types/index.ts`.

```
academia (multi-tenant desde o dia 1, mesmo com uma unidade)
  id, nome, cnpj, telefone, email, endereco, fuso, criado_em

usuario
  id, academia_id → academia, nome, email (único por academia),
  senha_hash, papel (gestor|professor|aluno), aluno_id? → aluno,
  ativo, ultimo_acesso, criado_em

aluno
  id, academia_id → academia, nome, email, telefone, nascimento,
  faixa, graus, status (ativo|inativo|experimental),
  matricula_em, plano_id → plano, vencimento_dia,
  responsavel_nome?, responsavel_telefone?, observacoes?,
  foto_url?, criado_em, atualizado_em

plano
  id, academia_id, nome, descricao, valor_centavos,
  periodicidade (mensal|trimestral|semestral|anual),
  aulas_por_semana (int | null = ilimitado), ativo

turma
  id, academia_id, nome, professor_id → usuario,
  faixa_etaria, nivel, cor

aula                       -- item recorrente do quadro de horários
  id, academia_id, turma_id → turma, titulo,
  dia_semana (0-6), inicio (time), fim (time), capacidade, local, ativa

chamada                    -- ocorrência concreta de uma aula; nasce no 1º check-in ou ao cancelar a aula
  id, academia_id, aula_id → aula, data (date),
  cancelada, cancelada_por → usuario, motivo
  UNIQUE (aula_id, data)

presenca                   -- só existe linha quando alguém agiu; FALTA = ausência de linha
  chamada_id → chamada, aluno_id → aluno,
  status (presente|ausente|justificado),
  origem (aluno = check-in | professor = correção),
  registrado_em, registrado_por → usuario, observacao
  PRIMARY KEY (chamada_id, aluno_id)

cobranca                   -- o que o aluno deve
  id, academia_id, aluno_id → aluno, plano_id → plano,
  competencia (YYYY-MM), vencimento (date), valor_centavos,
  status (aberta|paga|atrasada|cancelada), pago_em

transacao                  -- o que entrou e saiu do caixa
  id, academia_id, tipo (receita|despesa), categoria, descricao,
  valor_centavos, data, aluno_id?, cobranca_id?, metodo, conciliada

graduacao                  -- histórico, não só o estado atual
  id, aluno_id → aluno, faixa, graus, data,
  concedida_por → usuario, observacao

log_auditoria
  id, academia_id, usuario_id, acao, entidade, entidade_id,
  dados_antes (jsonb), dados_depois (jsonb), ip, criado_em
```

**Decisões que importam:**

1. **Dinheiro em centavos, `integer`.** Nunca `float`.
2. **`academia_id` em toda tabela** desde o início, mesmo com uma unidade. Adicionar multi-tenant depois é uma migração dolorosa; deixar o campo agora é gratuito.
3. **`chamada` separada de `aula`.** `aula` é o horário recorrente ("segunda 19h"); `chamada` é o dia concreto. Sem essa separação não dá para registrar a aula de uma terça em que o professor mudou o conteúdo. Com o check-in, a `chamada` virou o registro de que a aula aconteceu (ou foi cancelada).
3b. **Falta não é gravada.** É a ausência de linha em `presenca` numa aula realizada. "Aula realizada" = não cancelada e com ao menos um presente (view `v_aula_realizada`). Uma rotina que "gerasse faltas" poderia falhar e deixar o dado errado; a view não falha.
4. **`graduacao` como histórico.** A faixa atual do aluno é a última graduação — mas a jornada inteira precisa ficar registrada, é o coração emocional do produto.
5. **`cobranca` separada de `transacao`.** Uma é o que se espera receber, a outra é o que entrou. Sem essa separação não existe relatório de inadimplência confiável.
6. **`log_auditoria`** desde o começo: quem mudou a faixa de quem, quem apagou qual lançamento.

### 6.3 Contrato de API

Base: `/api/v1`. Autenticação por `Authorization: Bearer <jwt>`. Respostas em JSON, erros no formato
`{ erro: { codigo, mensagem, campos? } }`.

| Método | Rota | Papel | Substitui no front |
|---|---|---|---|
| `POST` | `/auth/login` | público | `auth.entrar()` |
| `POST` | `/auth/refresh` | cookie | — |
| `POST` | `/auth/logout` | autenticado | `auth.sair()` |
| `GET` | `/auth/eu` | autenticado | leitura de `usuario` |
| `GET` | `/alunos?status&faixa&plano&busca&pagina` | gestor, professor | `store.alunos` |
| `POST` | `/alunos` | gestor, professor | `store.salvarAluno` (criação) |
| `GET` | `/alunos/:id` | gestor, professor | `AlunoDetalhe` |
| `PATCH` | `/alunos/:id` | gestor, professor | `store.salvarAluno` (edição) |
| `DELETE` | `/alunos/:id` | gestor | `store.removerAluno` |
| `GET` | `/alunos/:id/presencas` | gestor, professor | aba Presença da ficha (com a origem de cada registro) |
| `GET` | `/alunos/:id/cobrancas` | gestor | aba Financeiro da ficha |
| `POST` | `/alunos/:id/graduacoes` | gestor, professor | promoção de faixa |
| `GET` `POST` | `/planos` | gestor | `store.planos`, `salvarPlano` |
| `PATCH` | `/planos/:id` | gestor | `salvarPlano`, `alternarPlano` |
| `GET` | `/turmas` | autenticado | `TURMAS` |
| `GET` `POST` | `/aulas` | gestor, professor | `store.aulas`, `salvarAula` |
| `PATCH` `DELETE` | `/aulas/:id` | gestor, professor | `salvarAula`, `removerAula` |
| `GET` | `/chamadas?aula_id&data` | gestor, professor | `store.chamadaDe` (lista quem fez check-in e quem não fez) |
| `POST` | `/aulas/:aulaId/checkin` | aluno (o próprio) | `store.fazerCheckin` |
| `DELETE` | `/aulas/:aulaId/checkin` | aluno (o próprio) | `store.desfazerCheckin` |
| `PUT` | `/chamadas/:aulaId/:data/presencas/:alunoId` | gestor, professor | `store.marcarPresenca` (correção; grava `origem = professor`; vai para a auditoria) |
| `POST` | `/chamadas/:aulaId/:data/cancelar` | gestor, professor | cancelar aula / feriado |
| `GET` | `/cobrancas?competencia&status` | gestor | lista de inadimplência |
| `POST` | `/cobrancas/:id/pagar` | gestor | baixa de pagamento |
| `GET` `POST` | `/transacoes?mes&tipo` | gestor | `store.transacoes`, `salvarTransacao` |
| `DELETE` | `/transacoes/:id` | gestor | `store.removerTransacao` |
| `GET` | `/metricas/painel` | conforme papel | tudo em `selectors.ts` |
| `GET` | `/metricas/financeiro?meses=6` | gestor | `serieFinanceira()` |
| `GET` | `/metricas/presenca?semanas=8` | gestor, professor | `seriePresenca()` |
| `GET` | `/metricas/faixas` | autenticado | `distribuicaoFaixas()` |
| `GET` | `/metricas/ocupacao` | gestor, professor | `ocupacaoTurmas()` |

**Regra:** os cálculos de `selectors.ts` migram para o servidor. O front consome números prontos —
o celular não deve varrer 45 dias de chamadas para desenhar um cartão.

**Check-in.** `POST /aulas/:aulaId/checkin` é idempotente e as regras valem **no servidor**: só a aula do dia; só aluno matriculado na turma; recusa se a aula foi cancelada;
repetir é inofensivo (`on conflict do nothing`); o aluno **nunca sobrescreve** uma marcação do professor; `DELETE` só apaga o que o próprio aluno marcou.
Prazo para fazer o check-in e para o professor corrigir: **pendência E16**, a definir antes de implementar.

**Correção do professor.** Um registro por aluno e aula (`PUT .../:alunoId`), sem lote: não há mais uma chamada inteira para reenviar. Toda correção grava
`log_auditoria` com o estado antes e depois, porque ela muda a frequência que decide graduação.

### 6.4 Autorização

O front já implementa a guarda em `ExigePapel` — **isso é conveniência de navegação, não segurança**.
Todo endpoint valida o papel no servidor. Regras:

| Papel | Pode |
|---|---|
| `gestor` | Tudo dentro da própria academia |
| `professor` | Alunos, turmas, aulas, correção de presenças, graduações. **Não vê Financeiro nem Planos.** |
| `aluno` | Só a própria ficha, e a agenda |

Todo *query* filtra por `academia_id` da sessão. Nenhuma rota aceita `academia_id` vindo do cliente.

### 6.5 Rotinas automáticas

| Rotina | Quando | O que faz |
|---|---|---|
| Gerar cobranças | 1º de cada mês, 03:00 | Cria `cobranca` para cada aluno ativo conforme plano e `vencimento_dia` |
| Marcar atrasos | Diária, 04:00 | `cobranca` vencida e não paga → `status = atrasada`; recalcula `statusPagamento` do aluno |
| Lembrete de vencimento | Diária, 09:00 | Aviso 3 dias antes do vencimento |
| Convite de retorno | Semanal, segunda 09:00 | Alunos sem presença há 14 dias |
| Resumo do professor | Semanal, segunda 07:00 | Presença, novas matrículas e pendências da semana |
| Backup | Diária | Dump do Postgres para storage externo, retenção de 30 dias |

### 6.6 Integração do front com a API

Ordem que minimiza retrabalho:

1. Instalar `@tanstack/react-query` e criar `src/lib/api.ts` (cliente `fetch` com base URL, token e tratamento de erro).
2. Reescrever `src/app/auth.tsx` para chamar `/auth/login` e `/auth/eu`.
3. Reescrever `src/app/store.tsx`: cada função vira `useQuery` / `useMutation`. **Nenhuma página precisa mudar** — a interface do hook é a mesma.
4. Substituir os `selectors.ts` por chamadas a `/metricas/*`.
5. Apagar `src/data/mock.ts` e o bloco "Acessos de demonstração" da tela de login.
6. Adicionar estados de carregamento e erro por tela (os componentes `EmptyState` e `Carregando` já existem).

### 6.7 Migração de dados reais

A academia já tem histórico em planilha. Antes do "vai ao ar":

1. Exportar a planilha atual para CSV.
2. Escrever um script de importação (`scripts/importar.ts`) com validação Zod por linha.
3. Rodar em ambiente de *staging*, gerando um relatório de linhas rejeitadas.
4. Revisar as rejeições **junto com o professor** — ele reconhece os casos estranhos.
5. Importar em produção e conferir os totais (nº de alunos, soma das mensalidades) contra a planilha.
6. Manter a planilha como leitura por 30 dias, sem editar.

---

## 7. Segurança e LGPD

O sistema guarda dados pessoais de menores de idade. Isso não é opcional.

- [ ] Senhas com **Argon2id** (nunca MD5/SHA simples).
- [ ] JWT de acesso curto (15 min) + refresh em cookie `httpOnly`, `Secure`, `SameSite=Lax`.
- [ ] HTTPS obrigatório, HSTS ativo.
- [ ] Rate limit em `/auth/login` (5 tentativas / 15 min por IP).
- [ ] Toda entrada validada por schema no servidor.
- [ ] Consentimento explícito do responsável para dados de menores.
- [ ] Política de privacidade acessível dentro do sistema.
- [ ] Exportação dos dados do titular sob solicitação (direito de acesso).
- [ ] Exclusão / anonimização sob solicitação (direito ao esquecimento), preservando o que a legislação fiscal exige.
- [ ] Fotos de alunos só com autorização de imagem registrada.
- [ ] `log_auditoria` para acesso e alteração de dado pessoal.
- [ ] Backup criptografado, com restauração **testada** — backup não testado não é backup.

---

## 8. Infraestrutura e deploy

| Ambiente | Front | API | Banco |
|---|---|---|---|
| Desenvolvimento | `localhost:5173` | `localhost:3333` | Postgres em Docker |
| Staging | servido pela API | Railway (ambiente de teste) | Neon (branch gratuita) |
| Produção | servido pela API (mesma origem) | Railway | Neon |

**Demonstração atual:** o front está publicado em **GitHub Pages** a partir da pasta `app/dist`.
Como não há servidor para reescrever rotas, o app usa `HashRouter` e `base: './'` no Vite —
por isso as URLs têm `#` (ex.: `/#/painel`).

**Pipeline (GitHub Actions):**

1. `push` → lint + `tsc` + testes
2. `main` → build + deploy em staging
3. tag `v*` → deploy em produção (com aprovação manual)

---

## 9. Testes

| Nível | Ferramenta | Cobre |
|---|---|---|
| Unidade | Vitest | `selectors.ts`, `format.ts`, regras de cobrança e graduação |
| Componente | Testing Library | Formulários, validações, estados vazios |
| API | Vitest + Supertest | Cada endpoint, incluindo negação por papel |
| E2E | Playwright | Aluno faz check-in → professor vê e corrige → histórico do aluno |

**Fluxos que não podem quebrar** (E2E obrigatório):

1. Aluno faz check-in; o professor vê o registro, corrige para falta, e o aluno não consegue desfazer nem refazer.
2. Cadastrar aluno com plano e ver a cobrança gerada.
3. Registrar pagamento e o aluno sair da lista de inadimplentes.
4. Professor **não** conseguir abrir o Financeiro.
5. Aluno **não** conseguir ver a ficha, os dados nem o check-in de outro aluno.
6. Aluno **não** conseguir fazer check-in em aula de outro dia, de outra turma ou cancelada.

---

## 10. Cronograma sugerido

| Sprint | Duração | Entrega |
|---|---|---|
| 0 | — | **Validação do front-end com o professor** (seção 5) |
| 1 | 1 semana | Ajustes do front conforme a validação |
| 2 | 2 semanas | Banco, migrations, auth, CRUD de aluno e plano |
| 3 | 2 semanas | Turmas, aulas, chamadas, presença |
| 4 | 2 semanas | Cobranças, transações, rotinas automáticas |
| 5 | 1 semana | Endpoints de métricas + integração do painel |
| 6 | 1 semana | Graduações, auditoria |
| 7 | 1 semana | Testes E2E, LGPD, importação da planilha |
| 8 | 1 semana | Piloto com o professor usando de verdade, em paralelo à planilha |
| 9 | — | Corte definitivo |

Total estimado: **~11 semanas** após a validação do front.

---

## 11. Evolução pós-MVP

Em ordem de valor percebido:

1. **PWA instalável com check-in offline.** O tatame nem sempre tem sinal. Guardar o check-in e enviar quando a conexão voltar evita falta indevida.
2. **Portal do aluno completo.** Hoje o aluno só tem Painel, Agenda, Progresso e Check-in.
3. **Cobrança automatizada.** PIX com QR dinâmico (Asaas, Pagar.me ou Mercado Pago) e baixa automática na `cobranca`.
4. **WhatsApp.** Lembretes no canal que a academia realmente usa.
5. **Relatório de retenção.** *Cohort* por mês de matrícula — mostra em que ponto da jornada o aluno desiste.
6. **Programa técnico por faixa.** Currículo de técnicas com marcação do que o aluno já domina.
7. **Multi-unidade.** O `academia_id` já está no modelo; falta a troca de contexto na interface.
8. **Endurecer o check-in:** QR code no tatame, janela de horário, geolocalização, confirmação do professor (ver `ROADMAP.md`).

---

## 12. Riscos e decisões em aberto

| Risco | Impacto | Mitigação |
|---|---|---|
| Nome REDSHIELD sem registro/disponibilidade verificados, ou identidade visual que lembre outra marca | Médio — jurídico | Consultar INPI e domínio antes de divulgar; usar a identidade oficial da academia quando existir |
| Professor não adotar e voltar para a planilha | Alto — projeto morre | Piloto em paralelo (sprint 8); ele precisa sentir ganho antes do corte |
| Dados de menores sem consentimento | Alto — LGPD | Consentimento do responsável no cadastro, obrigatório |
| Escopo crescer durante a Fase 2 | Médio — atraso | Lista "fora do MVP" da seção 2 é o contrato |
| Migração da planilha com dados sujos | Médio — retrabalho | Importação com relatório de rejeição e revisão conjunta |

**Perguntas a responder com o professor:**

- Qual o critério **real** de graduação da academia? (O sistema usa 12 meses + 70% de frequência como palpite.)
- Como funciona hoje a aula experimental? Quantas aulas grátis?
- Existe desconto de irmão, plano família ou bolsa?
- Alunos podem trancar a matrícula? Por quanto tempo?
- Quem mais além dele vai usar o sistema? Tem recepcionista?

---

## 13. Glossário

| Termo | Significado |
|---|---|
| **Chamada** | Ocorrência de uma aula em uma data. Não é mais uma lista preenchida pelo professor: reúne os check-ins e as correções |
| **Check-in** | O próprio aluno registra presença na aula do dia, pelo celular, e vale na hora |
| **Grau** | Marcação intermediária dentro de uma faixa (0 a 4) |
| **Open Mat** | Treino livre, sem aula estruturada |
| **No-Gi** | Treino sem kimono |
| **MRR** | Receita recorrente mensal — soma das mensalidades ativas normalizada por mês |
| **Inadimplente** | Aluno com cobrança vencida e não paga |
| **Elegível à graduação** | Aluno que atingiu os critérios de tempo e frequência para ser avaliado |

---

## 14. Referências

- `redshield_guia_identidade_visual.md` — guia de direção visual provisório do sistema
- `referencia_visual_conceitual.png` — referência conceitual do painel (símbolo e fotos **não** são do REDSHIELD)
