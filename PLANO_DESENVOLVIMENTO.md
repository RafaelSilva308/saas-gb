# Plano de desenvolvimento — SaaS de gestão para academia de jiu-jitsu

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
| **Professor** | Chamada, organização das turmas, observações de treino, acompanhamento individual | Presença, Agenda, Alunos |
| **Aluno / responsável** | Calendário, presença, evolução de faixa, comunicados, próximos objetivos | Painel do aluno, Agenda, Progresso |

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
| 6 | Controle de presença por turma | ✅ Front-end pronto | `src/pages/Presenca.tsx` |
| 7 | Agenda de aulas | ✅ Front-end pronto | `src/pages/Agenda.tsx` |
| 8 | Progresso de faixas + comunicados | ✅ Front-end pronto | `src/pages/Progresso.tsx`, `Comunicados.tsx` |

**Fora do MVP** (registrado para não virar escopo escondido): app nativo, gateway de pagamento com
cobrança automática, catraca/QR code de entrada, loja online, multi-unidade (rede de academias),
relatórios fiscais e emissão de nota.

---

## 3. Identidade visual aplicada

Base: `graciebarra_saas_guia_identidade_visual.md` + `graciebarra_saas_direcao_visual.png`.

> ⚠️ **Aviso de marca.** As cores são **aproximações para prototipação**, não especificação
> oficial. Antes de publicar, confirme arquivos de marca, permissões de uso e regras da franquia
> com a liderança responsável. O sistema **não reproduz** o monograma, escudo, selo ou logotipo
> oficial da rede — usa uma marca abstrata própria (`src/components/Logo.tsx`) construída apenas
> com a geometria diagonal descrita no guia.

### 3.1 Sistema de cor (funcional, não decorativo)

| Papel | Token | Valor | Uso |
|---|---|---|---|
| Ação / urgência | `gb-red-600` | `#d40000` | CTA principal, alertas críticos. **Um por tela.** |
| Estrutura / confiança | `gb-blue-600` | `#1764a8` | Navegação, cabeçalho, links, estados ativos |
| Superfície | `white` / `gb-gray-100` | `#ffffff` / `#f2f4f6` | Cartões sobre fundo cinza claro |
| Texto forte | `gb-ink` | `#111111` | Títulos, números, ícones fortes |
| Texto auxiliar | `gb-gray-500` | `#667085` | Metadados, labels, informação secundária |
| Confirmação | `gb-success` | `#12805c` | Presença registrada, pagamento em dia |
| Atenção | `gb-warn` | `#b25e09` | Vence em breve, justificado |

Regra que o código segue: **nenhum estado depende só de cor**. Todo badge carrega rótulo textual,
toda faixa tem legenda, todo gráfico tem eixo e tooltip.

### 3.2 Tipografia

- **Títulos:** Barlow Condensed 700, caixa alta — classe `.gb-title`.
- **Corpo:** Inter 400/500/600.
- **Números de métrica:** `.gb-metric` (condensada, 2.5rem).
- **Labels:** `.gb-label` (11px, caixa alta, tracking largo, cinza médio).

### 3.3 Geometria diagonal

Usada **só em momentos de destaque**: painel institucional do login, cartão da próxima aula,
banner de comunicados. Classe `.gb-diagonal` + polígonos SVG abstratos. O resto do produto é limpo.

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
    │   ├── Logo.tsx           # marca abstrata própria
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
- **Chamada (Presença):** botões Presente/Justificado/Ausente com 40px de altura e largura total no celular — pensados para uso com o dedo, em pé, no tatame.
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
| `gestor@gb.com.br` | Gestor | Tudo, incluindo Financeiro e Planos |
| `professor@gb.com.br` | Professor | Alunos, Agenda, Presença, Progresso |
| `aluno@gb.com.br` | Aluno | Painel, Agenda, Progresso, Comunicados |

---

## 5. Checklist de validação da Fase 1

Antes de escrever uma linha de back-end, percorrer com o professor:

- [ ] Os quatro indicadores do painel são os certos? Falta algum? Sobra algum?
- [ ] A ordem das telas na navegação lateral bate com a rotina do dia?
- [ ] A tela de chamada funciona com o celular na mão, em pé, no tatame?
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
| Arquivos | S3 / Cloudflare R2 | Fotos de aluno, anexos de comunicado |
| Fila / agendamento | pg-boss ou node-cron | Lembretes de vencimento, resumo semanal |
| Testes | Vitest + Supertest | Mesmo runner do front |
| Observabilidade | Pino + Sentry | Log estruturado, erro rastreado |

> **Alternativa mais barata para começar:** Supabase (Postgres + Auth + Storage gerenciados).
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

chamada                    -- uma ocorrência concreta de uma aula
  id, academia_id, aula_id → aula, data (date),
  fechada, fechada_em, fechada_por → usuario
  UNIQUE (aula_id, data)

presenca
  id, chamada_id → chamada, aluno_id → aluno,
  status (presente|ausente|justificado), registrado_em
  UNIQUE (chamada_id, aluno_id)

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

comunicado
  id, academia_id, titulo, corpo, autor_id → usuario, data,
  destino (todos|turma|inadimplentes), turma_id?, fixado

log_auditoria
  id, academia_id, usuario_id, acao, entidade, entidade_id,
  dados_antes (jsonb), dados_depois (jsonb), ip, criado_em
```

**Decisões que importam:**

1. **Dinheiro em centavos, `integer`.** Nunca `float`.
2. **`academia_id` em toda tabela** desde o início, mesmo com uma unidade. Adicionar multi-tenant depois é uma migração dolorosa; deixar o campo agora é gratuito.
3. **`chamada` separada de `aula`.** `aula` é o horário recorrente ("segunda 19h"); `chamada` é o dia concreto. Sem essa separação não dá para registrar a aula de uma terça em que o professor mudou o conteúdo.
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
| `GET` | `/alunos/:id/presencas` | gestor, professor | aba Presença da ficha |
| `GET` | `/alunos/:id/cobrancas` | gestor | aba Financeiro da ficha |
| `POST` | `/alunos/:id/graduacoes` | gestor, professor | promoção de faixa |
| `GET` `POST` | `/planos` | gestor | `store.planos`, `salvarPlano` |
| `PATCH` | `/planos/:id` | gestor | `salvarPlano`, `alternarPlano` |
| `GET` | `/turmas` | autenticado | `TURMAS` |
| `GET` `POST` | `/aulas` | gestor, professor | `store.aulas`, `salvarAula` |
| `PATCH` `DELETE` | `/aulas/:id` | gestor, professor | `salvarAula`, `removerAula` |
| `GET` | `/chamadas?aula_id&data` | gestor, professor | `store.chamadaDe` |
| `PUT` | `/chamadas/:aulaId/:data/presencas` | gestor, professor | `store.marcarPresenca` (lote) |
| `POST` | `/chamadas/:aulaId/:data/fechar` | gestor, professor | `store.fecharChamada` |
| `GET` | `/cobrancas?competencia&status` | gestor | lista de inadimplência |
| `POST` | `/cobrancas/:id/pagar` | gestor | baixa de pagamento |
| `GET` `POST` | `/transacoes?mes&tipo` | gestor | `store.transacoes`, `salvarTransacao` |
| `DELETE` | `/transacoes/:id` | gestor | `store.removerTransacao` |
| `GET` `POST` | `/comunicados` | leitura: todos / escrita: gestor, professor | `store.comunicados` |
| `DELETE` | `/comunicados/:id` | gestor, professor | `removerComunicado` |
| `GET` | `/metricas/painel` | conforme papel | tudo em `selectors.ts` |
| `GET` | `/metricas/financeiro?meses=6` | gestor | `serieFinanceira()` |
| `GET` | `/metricas/presenca?semanas=8` | gestor, professor | `seriePresenca()` |
| `GET` | `/metricas/faixas` | autenticado | `distribuicaoFaixas()` |
| `GET` | `/metricas/ocupacao` | gestor, professor | `ocupacaoTurmas()` |

**Regra:** os cálculos de `selectors.ts` migram para o servidor. O front consome números prontos —
o celular não deve varrer 45 dias de chamadas para desenhar um cartão.

**Marcação de presença em lote.** `PUT /chamadas/:aulaId/:data/presencas` recebe o array inteiro e é
idempotente. O professor pode perder sinal no meio da chamada; reenviar o estado completo é seguro,
enviar deltas não é.

### 6.4 Autorização

O front já implementa a guarda em `ExigePapel` — **isso é conveniência de navegação, não segurança**.
Todo endpoint valida o papel no servidor. Regras:

| Papel | Pode |
|---|---|
| `gestor` | Tudo dentro da própria academia |
| `professor` | Alunos, turmas, aulas, chamadas, graduações, comunicados. **Não vê Financeiro nem Planos.** |
| `aluno` | Só a própria ficha, a agenda e os comunicados destinados a ele |

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
| Staging | Vercel (preview) | Railway / Fly.io | Neon (branch) |
| Produção | Vercel | Railway / Fly.io | Neon / Supabase |

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
| E2E | Playwright | Login → chamada → fechar chamada → ver no histórico |

**Fluxos que não podem quebrar** (E2E obrigatório):

1. Fazer a chamada de uma turma e fechá-la.
2. Cadastrar aluno com plano e ver a cobrança gerada.
3. Registrar pagamento e o aluno sair da lista de inadimplentes.
4. Professor **não** conseguir abrir o Financeiro.
5. Aluno **não** conseguir ver a ficha de outro aluno.

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
| 6 | 1 semana | Comunicados, graduações, auditoria |
| 7 | 1 semana | Testes E2E, LGPD, importação da planilha |
| 8 | 1 semana | Piloto com o professor usando de verdade, em paralelo à planilha |
| 9 | — | Corte definitivo |

Total estimado: **~11 semanas** após a validação do front.

---

## 11. Evolução pós-MVP

Em ordem de valor percebido:

1. **PWA instalável com chamada offline.** O tatame nem sempre tem sinal. Registrar offline e sincronizar depois é o recurso que mais muda o dia do professor.
2. **Portal do aluno.** Ficha, presença, evolução de faixa e comunicados no celular do aluno.
3. **Cobrança automatizada.** PIX com QR dinâmico (Asaas, Pagar.me ou Mercado Pago) e baixa automática na `cobranca`.
4. **WhatsApp.** Lembretes e comunicados no canal que a academia realmente usa.
5. **Relatório de retenção.** *Cohort* por mês de matrícula — mostra em que ponto da jornada o aluno desiste.
6. **Programa técnico por faixa.** Currículo de técnicas com marcação do que o aluno já domina.
7. **Multi-unidade.** O `academia_id` já está no modelo; falta a troca de contexto na interface.
8. **Check-in por QR code** na recepção, alimentando a presença sozinho.

---

## 12. Riscos e decisões em aberto

| Risco | Impacto | Mitigação |
|---|---|---|
| Uso da marca da rede sem autorização | Alto — jurídico | Validar com a liderança antes de publicar; hoje o sistema usa marca abstrata própria |
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
| **Chamada** | Registro de presença de uma aula em uma data específica |
| **Grau** | Marcação intermediária dentro de uma faixa (0 a 4) |
| **Open Mat** | Treino livre, sem aula estruturada |
| **No-Gi** | Treino sem kimono |
| **MRR** | Receita recorrente mensal — soma das mensalidades ativas normalizada por mês |
| **Inadimplente** | Aluno com cobrança vencida e não paga |
| **Elegível à graduação** | Aluno que atingiu os critérios de tempo e frequência para ser avaliado |

---

## 14. Referências

- `graciebarra_saas_guia_identidade_visual.md` — guia de direção visual do projeto
- `graciebarra_saas_direcao_visual.png` — referência conceitual do painel
- [Site oficial brasileiro da rede](https://graciebarra.com.br/)
