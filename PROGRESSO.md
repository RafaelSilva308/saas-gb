# PROGRESSO — o que já foi feito e o que falta

Registro vivo do desenvolvimento do back-end. **Atualize ao fim de cada sessão.** O plano e as decisões continuam no [`ROADMAP.md`](./ROADMAP.md) (fonte de verdade); aqui fica o estado da execução.

Última atualização: 2026-10-10 · branch `feat/api-fundacao` (commits locais; ainda não enviada ao GitHub, sem PR).

## Como rodar o back-end (`server/`)

```bash
cd server && npm install
cp .env.example .env     # ajustar DATABASE_URL (PostgreSQL 15+)
npm run migrar           # aplica db/schema.sql (001) + db/migrations/*
npm run seed             # dados equivalentes ao protótipo (recusa rodar em produção)
npm run dev              # API em http://localhost:3000/api/v1
npm test                 # 43 testes; sobe um PostgreSQL embutido, não precisa de banco local
npm run typecheck
```

- Testes: `vitest` + `embedded-postgres` (ou `TEST_DATABASE_URL`). Cada arquivo cria a própria academia isolada.
- Windows com acento no caminho do projeto: o `initdb` não aceita UTF8, então os testes usam `SQL_ASCII` nesse caso (ver `test/globalSetup.ts`). Em CI/Linux usa UTF8.
- Login de demonstração do seed: `gestor|professor|aluno@redshield.com.br`, senha `treino123`.

## Feito (Fases 2, 3 e 4 do ROADMAP, no lado do servidor)

| Área | O que existe | Onde |
|---|---|---|
| Fundação | Fastify 5 + TS estrito, pool `pg`, migrações versionadas com lock, erros `{erro:{codigo,mensagem,campos}}`, validação zod | `server/src/` |
| Migrações | 001 = `db/schema.sql`; 002 = tabelas de sessão e token de senha | `db/migrations/` |
| Autenticação | Argon2id; sessão em cookie `rs.sid` (httpOnly, SameSite=Strict), só o sha256 vai ao banco; checagem de Origin nas escritas; rate limit no login; recuperação e convite por token de uso único | `src/auth/`, `src/rotas/auth.ts` |
| Autorização | Por papel (`exigir(...)`) e por `academia_id` **sempre vindo da sessão**; testes provam isolamento entre academias e que aluno/professor não passam do que podem | `test/autorizacao.test.ts` |
| Planos | CRUD (gestor), valores em centavos | `src/rotas/planos.ts` |
| Alunos | CRUD, busca/filtros, graduações (trigger atualiza faixa), vínculo com turmas, consentimento do responsável com data/autor, convite de acesso do aluno, exclusão só sem histórico (senão 409), auditoria | `src/rotas/alunos.ts` |
| Turmas e aulas | CRUD; aula com histórico vira inativa em vez de sumir | `src/rotas/turmas.ts` |
| Presença (D1–D7) | Check-in do aluno (data decidida pelo servidor, idempotente, nunca sobrescreve o professor, desfaz só o que é seu); chamada do dia (check-in = presente, ausência de linha = falta); correção livre do professor, auditada; cancelar/reativar aula | `src/rotas/presenca.ts` |
| Seed | Academia, usuários, 5 planos, 5 turmas, 15 aulas, 35 alunos, 45 dias de presença | `src/db/seed.ts` |
| Fuso | "Hoje" calculado no fuso da academia, com relógio injetável nos testes | `src/datas.ts` |

## Falta

**Servidor**
- [ ] Fase 5: cobranças (geração mensal idempotente, baixa com `transacao` na mesma transação), lançamentos avulsos, inadimplência.
- [ ] Fase 6: métricas do Painel e frequência no servidor (hoje só a view `v_aluno_frequencia_30d`), lista de elegíveis para graduação (regra E1), painel do aluno só com dados dele (defeito 8).
- [ ] Fase 7: e-mail real (Resend; hoje só `mailerConsole`), rotinas agendadas, `envio_email` antes de enviar, interruptores `config_aviso`.
- [ ] Fase 8: política de privacidade, exportação/anonimização por titular, HSTS, revisão de segurança.
- [ ] Fase 9: importação da planilha (CSV) com relatório de rejeições.

**Infra** (nada disso foi criado ainda)
- [ ] Projetos novos na Neon e na Railway; papéis de banco (app sem dono / migração); SSL obrigatório.
- [ ] CI no GitHub Actions (lint + tsc + testes + build); deploy na Railway; Sentry e UptimeRobot.
- [ ] Backup `pg_dump` agendado **e um teste real de restauração**.

**Front** (nada foi ligado à API)
- [ ] `src/lib/api.ts`, TanStack Query, estados de carregamento/erro; conversão reais ↔ centavos; trocar `store.tsx`/`selectors.ts`/`mock.ts` por chamadas; remover `fecharChamada`/`chamada.fechada` (defeito 10).
- [ ] Telas novas: redefinir senha (`#/redefinir-senha?token=`), correção do professor, aula cancelada.

**Decisões do dono ainda abertas** (V1–V6, E1–E17 no ROADMAP). As que afetam o servidor já escrito: E8 (check-in offline), E11 (cancelamento), E14 (criança/sem celular), E16 (prazo do check-in), E17 (manter "justificado").

## Pontos de atenção do que foi escrito

- Check-in **não** aplica a capacidade da aula (decisão não tomada).
- `GET /planos` também é lido pelo professor (o contrato original só previa o gestor).
- `v_aluno_frequencia_30d` e o filtro de turma em `SELECT_ALUNO` usam `current_date` do banco, não o fuso da academia; a regra de `nascimento` usa data UTC. Revisar na Fase 6.
- Nos esquemas zod de PATCH **não** pode haver `.default()` (zod 4 aplica o default dentro de `.partial()` e sobrescreveria campos). Defaults são aplicados no insert com `??`.
- O front ainda não foi alterado; o GitHub Pages continua publicando o protótipo com dados simulados.
