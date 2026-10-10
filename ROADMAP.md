# Roadmap — do protótipo ao produto no ar

Documento de execução. Responde a quatro perguntas, nesta ordem:

1. [Onde estamos](#1-onde-estamos)
2. [O que está pendente de decisão](#2-pendências-de-decisão) (você e a academia)
3. [Em que ordem construir](#3-ordem-de-execução) até o lançamento
4. [Onde hospedar, enviar e-mail e quanto custa](#4-infraestrutura-e-custos)

Documentos relacionados: [`BANCO_DE_DADOS.md`](./BANCO_DE_DADOS.md) + [`db/schema.sql`](./db/schema.sql) (modelo do banco),
[`ROTEIRO_DEMONSTRACAO.md`](./ROTEIRO_DEMONSTRACAO.md) (sessão de validação com o professor) e
[`PLANO_DESENVOLVIMENTO.md`](./PLANO_DESENVOLVIMENTO.md) (visão de produto original; em caso de divergência, vale este roadmap).

---

## 1. Onde estamos

**Feito:** front-end navegável com dados simulados, 9 telas: Login, Painel, Alunos (+ficha), Planos, Financeiro, Presença,
Agenda, Progresso e Configurações. Publicado no GitHub Pages.

**Removido nesta entrega:** o módulo **Comunicados** inteiro (tela, rota, item de menu, estado, tipos, dados simulados, ação rápida do
Painel e menções nos documentos). O aviso "alunos sem treinar há 14 dias" no Painel continua, mas agora leva à lista de alunos.

**Não existe ainda:** back-end, banco, autenticação real, persistência (recarregar a página apaga o que foi cadastrado), e-mail,
cobrança, testes automatizados.

### Defeitos e lacunas do protótipo que o back-end não pode herdar

Encontrados lendo o código. Cada um já tem destino no roteiro abaixo.

| # | Problema | Onde | Consequência | Resolvido em |
|---|---|---|---|---|
| 1 | **Não existe vínculo aluno ↔ turma.** A chamada descobre quem aparece na turma infantil pela *existência de responsável* e por ids fixos no código (`'t3'`, `'t4'`) | `pages/Presenca.tsx` | Aluno adulto em duas turmas, ou criança em turma de adultos, não funciona. Criar turma nova quebra a regra | Fase 1 (front) + tabela `aluno_turma` |
| 2 | **Critério de graduação ignora a faixa.** Elegível = 12 meses de casa + 70% de frequência, igual para branca e roxa | `pages/Progresso.tsx` | Lista de elegíveis errada para faixas altas | Decisão E1 → Fase 1 |
| 3 | **Valores em reais (`number`) no front**, centavos (`integer`) no banco | `types/index.ts` | Erro de arredondamento ou cobrança 100× maior se a conversão for esquecida | Fase 2 (camada de API converte na borda) |
| 4 | **Situação de pagamento e frequência são gravadas no aluno** (`statusPagamento`, `frequencia30d`) | `types/index.ts`, `data/mock.ts` | Ficam desatualizadas assim que alguém paga ou falta | No banco viram *views* calculadas |
| 5 | **Login só confere o e-mail;** qualquer senha com 4+ caracteres entra | `app/auth.tsx` | Nenhuma segurança | Fase 2 |
| 6 | "Esqueci a senha", "Editar" (equipe) e "Salvar" em Configurações **não fazem nada** | `Entrar.tsx`, `Configuracoes.tsx` | Botões que parecem funcionar e não funcionam | Fase 1 (esconder ou implementar) |
| 7 | Dados de pessoas reais (menores) ainda sem nenhum registro de consentimento | cadastro de aluno | Risco LGPD | Fase 1 (campos) + Fase 8 |

---

## 2. Pendências de decisão

Sem estas respostas, algumas fases não começam. A coluna **Bloqueia** diz qual.
**Padrão sugerido** é o que eu faria se você não tivesse preferência — não é decisão tomada.

### 2.1 Para você decidir ou responder

| ID | Pergunta | Por que importa | Bloqueia | Padrão sugerido |
|---|---|---|---|---|
| V1 | **Você tem autorização para usar a marca Gracie Barra?** Os arquivos do repositório se chamam `graciebarra_*` e o guia visual mira essa identidade. Hoje o produto se chama "Tatame Gestão" com marca abstrata | Se a rede é franqueadora, o uso do nome, das cores e do material pode violar contrato de franquia. É o único risco que pode obrigar a refazer a identidade | Publicar para qualquer pessoa fora do círculo (Fase 0) | Tratar como produto independente "Tatame Gestão"; renomear os arquivos `graciebarra_*`; só usar a marca com autorização escrita |
| V2 | **Quem é o cliente?** Uma academia só (a sua / do professor) ou você pretende vender para várias? | Define se multi-tenant, cadastro de academia, cobrança do SaaS, termos de uso e suporte entram no escopo | Fase 2 (escopo de auth e tenant) | Uma academia na v1. O banco já tem `academia_id`, então abrir para várias depois não exige migração |
| V3 | **Quem paga a infraestrutura e quanto pode custar por mês?** | Decide entre o plano gratuito (R$ ~4/mês, sem backup automático) e o recomendado (~R$ 145/mês) — ver [seção 4](#4-infraestrutura-e-custos) | Fase 2 | Gratuito até o piloto; decidir antes do go-live |
| V4 | **Domínio:** qual nome e quem registra? (ex.: `tatamegestao.com.br`) | Necessário para e-mail com boa entrega (SPF/DKIM) e para o endereço definitivo. ~R$ 40/ano | Fase 7 | Registrar no seu CPF/CNPJ já agora, para garantir o nome |
| V5 | **Papel "aluno" entra na v1?** O front já tem a visão do aluno, mas o plano original coloca o portal do aluno como pós-MVP | Cada papel multiplica as regras de acesso e os testes. Sem aluno logado, a v1 é bem menor | Fase 2 | Sem login de aluno na v1. Gestor e professor apenas |
| V6 | **Cobrança automática (Pix/boleto/cartão com baixa automática) entra na v1 ou depois?** | É a maior dor financeira e o maior custo de desenvolvimento e de taxa. Sem ela, o Financeiro é registro manual | Fase 5 | Depois. v1 gera a cobrança e o professor dá baixa manualmente; Pix automático vira a primeira entrega pós-lançamento |
| V7 | **Prazo e data-alvo de lançamento?** | Estimativas abaixo assumem 1 desenvolvedor | Planejamento | — |
| V8 | **Quem desenvolve?** Você, eu com você, ou terceiro? | Define o ritmo e quem opera o servidor depois | Fase 2 | — |

### 2.2 Para ver com a academia (levar na sessão de validação)

Resolve-se com o [`ROTEIRO_DEMONSTRACAO.md`](./ROTEIRO_DEMONSTRACAO.md): cada pergunta aparece lá no momento certo da demonstração.

| ID | Pergunta | Bloqueia |
|---|---|---|
| E1 | **Critério real de graduação.** Tempo mínimo por faixa, frequência mínima, quantidade de graus, se há exame, se o professor decide sozinho | Fase 1 (tela Progresso) e regra de elegibilidade |
| E2 | **Planos reais:** nomes, valores, periodicidade. Existe trancamento? Desconto para irmãos/família? Taxa de matrícula? Aula experimental gratuita? | Fase 3 |
| E3 | **Como recebem hoje:** Pix na chave, boleto, cartão na maquininha, dinheiro? Em que dia do mês cobram — todos no mesmo dia ou cada um no seu? | Fases 3 e 5 |
| E4 | **Categorias de receita e despesa** que ele realmente usa (o protótipo traz uma lista inventada) | Fase 5 |
| E5 | **Turmas:** como se decide quem pertence a qual? Um aluno pode estar em mais de uma? Criança só em turma infantil? Quem é professor de qual turma? | Fase 4 (corrige o problema 1) |
| E6 | **Campos do cadastro:** precisa de CPF? Endereço? Contato de emergência? Atestado médico? Foto? *(atenção: dado de saúde é dado sensível pela LGPD)* | Fase 3 |
| E7 | **Menores:** quem assina o consentimento, como (papel ou digital), e se há termo de uso de imagem | Fase 1 (campos) e Fase 8 |
| E8 | **A chamada acontece com internet no tatame?** O professor usa celular próprio ou tablet? | Fase 4 (decide se a v1 precisa funcionar offline) |
| E9 | **Quais avisos por e-mail fazem sentido?** Os alunos têm e-mail? (crianças geralmente não — o aviso iria para o responsável) | Fase 7 |
| E10 | **A planilha atual:** formato, quantidade de linhas, quem exporta, quanto histórico (anos de presença?) vale migrar | Fase 9 |
| E11 | **Feriados e aulas canceladas:** como ele trata hoje? | Fase 4 |
| E12 | **O que ele faz todo dia?** Qualquer tarefa diária que exija mais de 2 cliques a partir do Painel precisa de ajuste | Fase 1 |
| E13 | **Disposição para o piloto em paralelo à planilha** por 2 a 4 semanas | Fase 10 |

---

## 3. Ordem de execução

Princípio: **cada fase termina com algo que o professor consegue usar**, e nenhuma fase começa sem que as decisões que a bloqueiam estejam respondidas.
Esforço estimado para 1 desenvolvedor; ajuste conforme dedicação.

```
Fase 0  Desbloquear         ─┐ sem código
Fase 1  Ajustar o front     ─┘
Fase 2  Fundação             ─ banco, auth, deploy
Fase 3  Alunos e planos      ┐
Fase 4  Turmas e chamada     ├ núcleo do produto
Fase 5  Cobranças e caixa    ┘
Fase 6  Painel e graduações
Fase 7  E-mail e rotinas
Fase 8  Segurança, LGPD e testes
Fase 9  Importar a planilha
Fase 10 Piloto → lançamento
```

### Fase 0 — Desbloquear (sem código) · ~1 semana

- [ ] Resolver **V1** (marca). Se não houver autorização, renomear os arquivos `graciebarra_*` antes de qualquer divulgação.
- [ ] Responder **V2, V5, V6** (escopo da v1) — são as três que mais mudam o tamanho do trabalho.
- [ ] Rodar a sessão com o professor usando o [`ROTEIRO_DEMONSTRACAO.md`](./ROTEIRO_DEMONSTRACAO.md) e registrar as respostas **E1–E13**.
- [ ] Registrar o domínio (**V4**).
- [ ] Repositório: deixar privado até V1 estar resolvido (GitHub Pages em repositório privado exige plano pago; ver seção 4 para a alternativa gratuita).

**Pronto quando:** V1, V2, V5, V6 respondidas e o checklist da seção 5 do `PLANO_DESENVOLVIMENTO.md` marcado com o professor.

### Fase 1 — Ajustar o front conforme a validação · ~1 semana

- [ ] Corrigir os problemas 1, 2 e 6 da [tabela da seção 1](#defeitos-e-lacunas-do-protótipo-que-o-back-end-não-pode-herdar):
  - vínculo **aluno ↔ turma** no cadastro e na chamada (remove os ids fixos);
  - regra de graduação conforme **E1**;
  - esconder ou implementar botões inertes ("Esqueci a senha", "Editar" da equipe, "Salvar" de Configurações).
- [ ] Campos de consentimento do responsável no cadastro de aluno (**E7**), e ajustar os campos do cadastro conforme **E6**.
- [ ] Ajustar planos, categorias e textos conforme **E2, E4, E12**.
- [ ] Decidir o destino dos "Avisos automáticos" (Configurações): manter só os que **E9** confirmar.
- [ ] Preparar o front para a API: `src/lib/api.ts`, TanStack Query, estados de carregamento/erro por tela. `store.tsx` continua sendo o único ponto de costura.

**Pronto quando:** o professor percorre o fluxo diário (chamada, cadastro, ver quem deve) sem pedir ajuste de layout ou texto.

### Fase 2 — Fundação · ~1 a 2 semanas

- [ ] Criar o projeto no provedor escolhido (ver seção 4) — ambientes **dev** e **prod** separados desde o início.
- [ ] Aplicar o [`db/schema.sql`](./db/schema.sql) como migração versionada (001) e criar um *seed* equivalente aos dados simulados atuais.
- [ ] Autenticação real (e-mail + senha; recuperação de senha por e-mail). Sessão com cookie `httpOnly` ou o fluxo do provedor.
- [ ] **Autorização no servidor**, por papel e por `academia_id` — a guarda do front é só navegação. Todo acesso filtra pela academia da sessão; nenhuma rota aceita `academia_id` vindo do cliente.
- [ ] Camada de API no front: conversão **reais ↔ centavos** na borda (problema 3) e datas em ISO.
- [ ] CI no GitHub Actions: lint + `tsc` + testes + build. Deploy automático do front.
- [ ] Monitoramento de erro (Sentry) e de disponibilidade (UptimeRobot), ambos gratuitos.
- [ ] **Backup:** rotina de `pg_dump` agendada para armazenamento externo, e **um teste de restauração feito de verdade**.

**Pronto quando:** login real funciona em produção; um usuário de uma academia **não consegue** ler dados de outra (teste automatizado); o backup foi restaurado com sucesso em um banco vazio.

### Fase 3 — Alunos e planos · ~1 a 2 semanas

- [ ] CRUD de planos (gestor) e de alunos (gestor + professor), com filtros, busca e exportação já existentes no front.
- [ ] Ficha do aluno: resumo, histórico de presença e pagamentos (as duas últimas abas ficam vazias até as fases 4 e 5).
- [ ] Consentimento do responsável gravado com data e autor.
- [ ] Registro em `log_auditoria` de criação, edição e remoção de aluno.

**Pronto quando:** o professor cadastra, edita e consulta alunos reais; recarregar a página não perde nada.

### Fase 4 — Turmas, agenda e chamada · ~2 semanas

- [ ] CRUD de turmas, aulas e do vínculo aluno ↔ turma.
- [ ] Chamada: `PUT /chamadas/:aula/:data/presencas` **idempotente**, recebendo o estado inteiro (reenviar é seguro; enviar só mudanças não é). Fechamento da chamada.
- [ ] Se **E8** disser que falta sinal no tatame: fila local no navegador que reenvia quando a conexão voltar. Se não, adiar para o pós-lançamento.
- [ ] Tratamento de feriado/aula cancelada (**E11**).

**Pronto quando:** o professor faz a chamada de uma aula real pelo celular, fecha, e o histórico do aluno mostra a presença.

### Fase 5 — Cobranças e financeiro · ~2 semanas

- [ ] Geração mensal de `cobranca` para cada aluno ativo, conforme plano e dia de vencimento. Idempotente (`unique (aluno_id, competencia)`).
- [ ] Baixa manual de cobrança: cria a `transacao` vinculada e marca como paga **na mesma transação de banco**.
- [ ] Lançamento avulso de receitas e despesas, com as categorias de **E4**.
- [ ] Lista de inadimplência a partir das cobranças abertas vencidas (a "situação de pagamento" do aluno é calculada, não gravada).
- [ ] Opcional (decidir em **V6**): botão "Cobrar pelo WhatsApp" que abre `wa.me/<telefone>?text=<mensagem pronta>`. Custo zero, 1 clique por aluno, sem integração.

**Pronto quando:** o professor fecha um mês real — gera cobranças, dá baixa em pagamentos — e o resultado bate com a planilha dele.

### Fase 6 — Painel, métricas e graduações · ~1 a 2 semanas

- [ ] Trocar `selectors.ts` por consultas no servidor (SQL/views), para o celular não varrer 45 dias de chamadas.
- [ ] Graduações: registrar promoção, histórico por aluno, e a lista de elegíveis conforme a regra de **E1**.
- [ ] Auditoria de ponta a ponta nas ações sensíveis (mudança de faixa, remoção de lançamento).

**Pronto quando:** os quatro indicadores do Painel batem com contas feitas à mão sobre os dados reais.

### Fase 7 — E-mail e rotinas automáticas · ~1 semana

- [ ] Provedor de e-mail configurado com o domínio (SPF, DKIM, DMARC) — **V4** precisa estar resolvida.
- [ ] Rotinas: gerar cobranças (dia 1), lembrete de vencimento, aviso de atraso, resumo semanal, só dos avisos que **E9** confirmou.
- [ ] Registro em `envio_email` antes de enviar, com índice único, para a rotina **nunca mandar o mesmo aviso duas vezes**.
- [ ] Respeitar os interruptores de Configurações (`config_aviso`).
- [ ] Atenção ao limite diário do provedor gratuito ao concentrar vencimentos (ver seção 4).

**Pronto quando:** um lembrete real chega na caixa de entrada (não no spam) e rodar a rotina duas vezes não duplica o envio.

### Fase 8 — Segurança, LGPD e testes · ~1 a 2 semanas

- [ ] Testes de ponta a ponta nos 5 fluxos que não podem quebrar: chamada, cadastro com cobrança, baixa de pagamento, **professor não abre Financeiro**, **um aluno/academia não vê dados de outro**.
- [ ] Rate limit no login; HTTPS e HSTS; senhas com Argon2id ou o equivalente do provedor.
- [ ] Política de privacidade acessível no sistema; exportação e exclusão/anonimização de dados de um titular sob pedido.
- [ ] Revisão de segurança do código e das regras de acesso do banco.
- [ ] Teste de restauração de backup repetido, agora com dados reais de teste.

**Pronto quando:** o checklist de segurança da seção 7 do `PLANO_DESENVOLVIMENTO.md` está inteiro marcado.

### Fase 9 — Importar a planilha · ~1 semana

- [ ] Exportar a planilha em CSV (**E10**).
- [ ] Script de importação com validação por linha e **relatório de linhas rejeitadas**.
- [ ] Rodar primeiro em ambiente de teste; revisar as rejeições **junto com o professor**.
- [ ] Importar em produção e conferir totais: número de alunos e soma das mensalidades contra a planilha.

**Pronto quando:** os totais batem e o professor reconhece os alunos importados.

### Fase 10 — Piloto e lançamento · 2 a 4 semanas

- [ ] **Piloto em paralelo à planilha**: o professor usa o sistema de verdade, e a planilha continua sendo atualizada. É o teste que decide se ele adota ou volta para o papel.
- [ ] Registrar toda reclamação e todo "ficou chato de fazer"; corrigir antes do corte.
- [ ] **Go-live:** decidir (**V3**) se sobe para o plano pago com backup automático; apontar o domínio definitivo; remover o bloco "Acessos de demonstração" do login e apagar `mock.ts`.
- [ ] Planilha vira somente leitura por 30 dias.

**Pronto quando:** 30 dias de operação sem voltar à planilha.

### Depois do lançamento

Em ordem de valor, sujeita ao que o piloto mostrar:

1. Pix com cobrança automática e baixa automática (Asaas, Mercado Pago ou similar).
2. Chamada offline (PWA instalável) — sobe de prioridade se **E8** indicar sinal ruim.
3. Portal do aluno (se **V5** adiou).
4. Envio por WhatsApp via API oficial (tem custo por conversa).
5. Relatório de retenção por mês de matrícula.
6. Check-in por QR code; multi-unidade; programa técnico por faixa.

**Total estimado até o go-live: ~12 a 17 semanas** de trabalho de 1 desenvolvedor, sem contar a espera pelas respostas da Fase 0.

---

## 4. Infraestrutura e custos

> **Preços:** são aproximados, baseados no que eu conheço dos planos de cada serviço, e **mudam**. Confira a página oficial antes de assinar.
> Conversão usada: US$ 1 ≈ R$ 5,50.

### 4.1 Opções de arquitetura

| | **A — Tudo gerenciado** (recomendada) | **B — Servidor próprio** | **C — Meio-termo** |
|---|---|---|---|
| Front | Cloudflare Pages | Cloudflare Pages | Cloudflare Pages |
| Banco | Supabase (Postgres) | Postgres no próprio servidor | Neon (Postgres) |
| Login | Supabase Auth | Código próprio (JWT + Argon2id) | Código próprio |
| API / regras | Regras de acesso no banco (RLS) + funções de borda | Node + Fastify | Node + Fastify |
| Rotinas | `pg_cron` + funções de borda | `node-cron` no servidor | GitHub Actions agendado |
| Servidor | nenhum | VPS (Hetzner ~€4–5/mês ou Oracle Free) | Railway (~US$ 5/mês) |
| Custo mínimo | **~R$ 3/mês** (só o domínio) | ~R$ 30/mês | ~R$ 30/mês |
| Custo para operar sério | **~R$ 145/mês** (Supabase Pro) | ~R$ 30/mês + seu tempo | ~R$ 60/mês |
| Esforço de desenvolvimento | **menor** | maior | médio |
| Quem cuida de segurança/atualização | o provedor | **você** | você, parcialmente |
| Risco principal | regra de acesso (RLS) mal escrita vaza dados entre academias | você vira o suporte do servidor | dois provedores para acompanhar |
| Portabilidade | o banco é Postgres puro; as regras em RLS precisam ser reescritas se sair | alta | alta |

**Minha recomendação: A.** Para uma academia, com dezenas ou poucas centenas de alunos, o volume de dados é minúsculo (dezenas de MB) e o que
mais custa é o **tempo** de montar autenticação, recuperação de senha e backup — o que A entrega pronto.
O custo da escolha é real: a segurança passa a depender de políticas de acesso no banco, e **isso precisa de testes** (Fase 8). Se você
prefere manter a regra de acesso em código que se lê de cima para baixo, escolha B ou C e aceite o custo de operar.

O modelo em `db/schema.sql` serve para as três opções. O que muda entre elas é onde mora a lógica, não o banco.

### 4.2 Por que não só o plano gratuito para sempre

O plano gratuito do Supabase tem três limitações que importam para uma operação real:

- **Sem backup automático** (backup diário só nos planos pagos). Mitigação gratuita: `pg_dump` agendado no GitHub Actions para um armazenamento
  externo (Cloudflare R2 ou Backblaze B2, 10 GB gratuitos). **Só vale se a restauração for testada** (Fases 2 e 8).
- **Projeto pausa após ~1 semana sem atividade.** Com uso diário isso não acontece, mas férias coletivas ou um recesso podem disparar. Configure o monitor de disponibilidade.
- **E-mail de autenticação embutido é muito limitado** (poucos por hora). Para recuperação de senha em produção é obrigatório configurar um SMTP próprio (seção 4.3).

O sistema guarda **dados de menores e histórico financeiro**. Minha avaliação: no lançamento, pagar o plano com backup é proporcional ao risco.
Isso é a decisão **V3** — é sua, e o piloto roda no gratuito de qualquer forma.

### 4.3 Envio de e-mail

| Serviço | Gratuito | Pago (aprox.) | Quando escolher |
|---|---|---|---|
| **Resend** (recomendado) | 3.000/mês, **100/dia**, 1 domínio | ~US$ 20/mês para 50 mil | API simples, ótima documentação. Começar aqui |
| **Brevo** | 300/dia (~9 mil/mês) | a partir de ~US$ 9/mês | Se o limite de 100/dia do Resend apertar |
| **Amazon SES** | — | ~US$ 0,10 por 1.000 e-mails | Mais barato em volume. Exige conta AWS e sair do *sandbox*; configuração mais trabalhosa |

**Cuidado com o limite diário.** Lembrete "3 dias antes do vencimento": se todos os alunos vencem no mesmo dia (ex.: dia 10), 200 alunos geram
200 e-mails em um dia — mais que o limite de 100/dia do Resend. Soluções: espalhar o vencimento (dias 5, 10, 15, 20), usar Brevo, ou
enfileirar o envio em lotes de 100/dia. Isso volta para a decisão **E3**.

**Necessário em qualquer opção:** domínio próprio com SPF, DKIM e DMARC configurados. Sem isso, os e-mails caem no spam.
Alunos menores geralmente não têm e-mail; o aviso deve ir para o e-mail do responsável (**E9**).

**Alternativa de custo zero para cobrança:** link do WhatsApp (`wa.me`) com mensagem pronta, aberto manualmente pelo professor.
Não é automação, mas resolve o problema de "como cobrar" sem pagar a API oficial.

### 4.4 Demais serviços

| Necessidade | Escolha de menor custo | Custo |
|---|---|---|
| Hospedagem do front | **Cloudflare Pages** (banda ilimitada, repositório privado permitido). GitHub Pages só funciona de graça em repositório **público** | R$ 0 |
| Domínio `.com.br` | registro.br | ~R$ 40/ano |
| Armazenar fotos de aluno (se **E6** pedir) | Supabase Storage (1 GB) ou Cloudflare R2 (10 GB) | R$ 0 |
| Backup externo | Cloudflare R2 ou Backblaze B2 (10 GB cada) | R$ 0 |
| Erros em produção | Sentry (plano gratuito, ~5 mil eventos/mês) | R$ 0 |
| Monitor de disponibilidade | UptimeRobot (plano gratuito) | R$ 0 |
| Pix automático (pós-lançamento) | Mercado Pago, Asaas ou similar — **cobram taxa por transação** | variável |
| WhatsApp oficial (pós-lançamento) | API oficial — cobra por conversa | variável |

### 4.5 Custo mensal por etapa (arquitetura A)

| Etapa | Custo mensal | Observação |
|---|---|---|
| Construção e piloto | **~R$ 3** | Domínio (R$ 40/ano) e tudo nos planos gratuitos. Backup por `pg_dump` |
| Operação, mínimo absoluto | ~R$ 3 | Igual ao piloto; **sem backup gerenciado**, só o que você montou |
| Operação recomendada | **~R$ 145** | Supabase Pro (~US$ 25) com backup diário e sem pausa. E-mail ainda gratuito |
| Se o volume de e-mail crescer | + ~R$ 50 a R$ 110 | Resend/Brevo pago |
| Pix automático | + taxa por cobrança | Só depois do lançamento e de **V6** |

---

## 5. Critério de "no ar"

O produto está lançado quando **todos** os itens abaixo forem verdadeiros:

- [ ] V1 resolvida (marca) e domínio definitivo apontando para o sistema.
- [ ] Login real; nenhuma conta de demonstração, nenhum `mock.ts`.
- [ ] Teste automatizado provando que professor não vê Financeiro e que uma academia não vê dados de outra.
- [ ] Backup diário rodando **e restaurado com sucesso** pelo menos uma vez.
- [ ] Consentimento do responsável registrado para todo aluno menor e política de privacidade acessível.
- [ ] Dados da planilha importados e conferidos com o professor.
- [ ] Piloto de 2+ semanas em paralelo concluído, com o professor dizendo que não quer voltar para a planilha.
- [ ] Monitoramento de erro e de disponibilidade ativos.

## 6. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Uso da marca sem autorização | Alto — jurídico | **V1**, antes de divulgar |
| Professor não adota e volta à planilha | Alto — o projeto morre | Sessão de validação (Fase 0), piloto paralelo (Fase 10) |
| Falha de regra de acesso expõe dados entre academias ou de menores | Alto — LGPD | Testes automáticos de acesso (Fase 8), revisão de segurança |
| Perda de dados sem backup restaurável | Alto | Backup testado desde a Fase 2 |
| E-mails caindo no spam / estourando limite | Médio | Domínio com SPF/DKIM/DMARC; vencimentos espalhados; Brevo como reserva |
| Escopo crescer (pagamento, WhatsApp, portal do aluno) | Médio — atraso | Itens "Depois do lançamento" não entram antes do go-live |
| Dependência de um único desenvolvedor | Médio | Documentação, migrações versionadas, CI desde a Fase 2 |
