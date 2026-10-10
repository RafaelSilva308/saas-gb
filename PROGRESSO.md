# PROGRESSO — o que já foi feito e o que falta

Registro vivo do desenvolvimento do back-end. **Atualize ao fim de cada sessão.** O plano e as decisões continuam no [`ROADMAP.md`](./ROADMAP.md) (fonte de verdade); aqui fica o estado da execução.

Última atualização: 2026-10-10 · branch `feat/api-fundacao` (sem PR). **O servidor está completo para a v1; faltam o front, as contas de infraestrutura e as decisões do dono.**

## Como rodar o back-end (`server/`)

```bash
cd server && npm install
cp .env.example .env     # ajustar DATABASE_URL (PostgreSQL 15+)
npm run migrar           # aplica db/schema.sql (001) + db/migrations/*
npm run seed             # dados equivalentes ao protótipo (recusa rodar em produção)
npm run dev              # API em http://localhost:3000/api/v1
npm test                 # 80 testes; sobe um PostgreSQL embutido, não precisa de banco local
npm run typecheck && npx tsc -p tsconfig.test.json --noEmit
npm run nova-academia    # cria academia + gestor (variáveis ACADEMIA_NOME, GESTOR_NOME, GESTOR_EMAIL, ACADEMIA_FUSO)
npm run rotinas          # roda uma vez as rotinas (cobranças do mês e avisos)
```

- Testes: `vitest` + `embedded-postgres` (ou `TEST_DATABASE_URL`). Cada arquivo cria a própria academia isolada.
- Windows com acento no caminho do projeto: o `initdb` não aceita UTF8, então os testes usam `SQL_ASCII` nesse caso (ver `test/globalSetup.ts`). Em CI/Linux usa UTF8.
- Login de demonstração do seed: `gestor|professor|aluno@redshield.com.br`, senha `treino123`.
- Colocar no ar: [`DEPLOY.md`](./DEPLOY.md).

## Feito (servidor, fases 2 a 9 do ROADMAP)

| Área | O que existe | Onde |
|---|---|---|
| Fundação | Fastify 5 + TS estrito, pool `pg`, migrações versionadas com lock, erros `{erro:{codigo,mensagem,campos}}`, validação zod | `server/src/` |
| Migrações | 001 = `db/schema.sql`; 002 autenticação; 003 financeiro/rotinas/LGPD | `db/migrations/` |
| Autenticação | Argon2id; sessão em cookie `rs.sid` (httpOnly, SameSite=Strict), só o sha256 no banco; checagem de Origin nas escritas; rate limit no login; recuperação e convite por token de uso único | `src/auth/`, `src/rotas/auth.ts` |
| Autorização | Por papel (`exigir(...)`) e por `academia_id` **sempre da sessão**; testes provam isolamento entre academias | `test/autorizacao.test.ts` |
| Planos, alunos, turmas | CRUD, graduações, vínculo aluno-turma, consentimento do responsável, convite de acesso, auditoria | `src/rotas/{planos,alunos,turmas}.ts` |
| Presença (D1–D7) | Check-in do aluno; chamada do dia (ausência de linha = falta); correção livre do professor, auditada; cancelar/reativar aula | `src/rotas/presenca.ts` |
| Financeiro | Geração mensal idempotente de cobranças; baixa com `transacao` na mesma transação; estorno e cancelamento; inadimplência; lançamentos avulsos e categorias | `src/rotas/financeiro.ts`, `src/financeiro.ts` |
| Métricas | Painel (o aluno só vê os próprios dados: defeito 8), financeiro, presença, faixas, ocupação, elegíveis à graduação (regra **provisória** até E1) | `src/rotas/metricas.ts` |
| E-mail e rotinas | Resend (ou console sem chave); `envio_email` gravado **antes** de enviar, com índice único (nunca duplica); avisos de vencimento, atraso, aniversário, ausência e resumo semanal; respeita `config_aviso` (sem linha = desligado, E9) e a hora local da academia; agendador no processo (`ROTINAS=1`) | `src/rotinas.ts`, `src/email.ts`, `src/rotas/configuracoes.ts` |
| LGPD | Exportação JSON do titular e anonimização irreversível (mantém valores fiscais e contagem de presença, apaga dados pessoais, encerra o acesso, bloqueia edição depois) | `src/rotas/lgpd.ts` |
| Importação | `POST /alunos/importar` de CSV (`,` ou `;`, BOM, datas dd/mm/aaaa). **Simula por padrão**; relatório de linhas rejeitadas; duplicados por e-mail ou nome+nascimento | `src/importacao.ts`, `src/rotas/importacao.ts` |
| Segurança HTTP | CSP (só o Google Fonts como origem externa), nosniff, X-Frame-Options, Referrer-Policy, HSTS em produção, `no-store` na API | `src/app.ts` |
| Infra como código | `Dockerfile` (API serve o front), `railway.json` (migra antes do deploy, healthcheck `/saude`), CI, backup diário criptografado **com teste de restauração**, papéis de banco de mínimo privilégio | `Dockerfile`, `.github/workflows/`, `scripts/`, `db/papeis.sql` |
| Documentos | Passo a passo de deploy; modelo de política de privacidade (precisa de revisão jurídica) | `DEPLOY.md`, `POLITICA_DE_PRIVACIDADE.md` |

## Falta

**Depende de você (contas e decisões)**
- [ ] Criar os projetos **novos** na Neon e na Railway e preencher variáveis/segredos (passo a passo em `DEPLOY.md`). Nada disso foi executado: o `Dockerfile`, o `railway.json` e os fluxos de CI/backup **nunca rodaram** (sem Docker nem `pg_dump` no ambiente de desenvolvimento). Confira o primeiro CI e rode o backup manualmente (*Run workflow*) para ver o teste de restauração passar.
- [ ] Conta no Resend com domínio verificado (SPF/DKIM/DMARC), UptimeRobot e, opcionalmente, Sentry.
- [ ] **V1**: nome/INPI/domínio; retirar `referencia_visual_conceitual.png` do repositório antes de divulgar.
- [ ] Revisão jurídica da política de privacidade e página/link dela dentro do sistema.
- [ ] Decisões abertas: **E1** (regra de graduação), E8 (check-in offline), E9 (quais avisos ligar), E11 (cancelamento), E14 (criança/sem celular), E16 (prazo do check-in), E17 (manter "justificado"), V1–V6.

**Front** (nada foi ligado à API; o GitHub Pages continua publicando o protótipo com dados simulados, de propósito, para a demonstração não depender de servidor)
- [ ] `src/lib/api.ts`, TanStack Query, estados de carregamento/erro; conversão reais ↔ centavos; trocar `store.tsx`/`selectors.ts`/`mock.ts` por chamadas (cada função do `store.tsx` corresponde a um endpoint); remover `fecharChamada`/`chamada.fechada` (defeito 10).
- [ ] Telas novas: redefinir senha (`#/redefinir-senha?token=`), correção do professor, aula cancelada, importação de CSV (simular → confirmar), exportar/anonimizar na ficha do aluno.
- [ ] Painel do aluno só com dados dele (o servidor já garante; falta a tela).

**Depois do front**
- [ ] Teste de ponta a ponta no navegador, piloto em paralelo à planilha e go-live (ROADMAP, fases 9 e 10).

## Pontos de atenção

- Check-in **não** aplica a capacidade da aula (decisão não tomada).
- `GET /planos` também é lido pelo professor (o contrato original só previa o gestor).
- Nos esquemas zod de PATCH **não** pode haver `.default()` (zod 4 aplica o default dentro de `.partial()`). Defaults no insert com `??`.
- Anonimizar não tem volta e mantém cobranças/lançamentos pagos por obrigação fiscal; confirme o prazo de guarda com o contador.
- O seed (`npm run seed`) cria categorias financeiras padrão só pelo CLI; `semear()` em si não as cria (um teste cria "Aluguel" e espera 201).
- A importação grava consentimento LGPD **somente** se o gestor informar `consentimentoPor`; sem isso o cadastro fica sem consentimento registrado.
