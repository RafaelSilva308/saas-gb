# REDSHIELD — sistema de gestão da academia

Sistema de gestão da academia REDSHIELD (jiu-jitsu brasileiro): alunos, planos, presença, agenda,
progresso de faixas e financeiro em um só lugar.

**Este repositório contém a Fase 1 — o front-end completo, navegável, com dados simulados.**
O back-end só começa depois que as telas forem validadas. O plano completo está em
[`PLANO_DESENVOLVIMENTO.md`](./PLANO_DESENVOLVIMENTO.md).

## Documentos

| Arquivo | Para quê |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Contexto resumido para quem (ou qual sessão) retomar o projeto |
| [`ROADMAP.md`](./ROADMAP.md) | **Fonte de verdade:** decisões tomadas, pendências, ordem de execução, custos |
| [`BANCO_DE_DADOS.md`](./BANCO_DE_DADOS.md), [`db/schema.sql`](./db/schema.sql) | Modelo do banco (PostgreSQL), testado |
| [`ROTEIRO_DEMONSTRACAO.md`](./ROTEIRO_DEMONSTRACAO.md) | Sessão de validação com o professor |
| [`PLANO_DESENVOLVIMENTO.md`](./PLANO_DESENVOLVIMENTO.md) | Visão de produto original e contrato de API |

## Rodando localmente

```bash
cd app
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Acessos de demonstração

Senha `treino123` para todos.

| E-mail | Papel | Enxerga |
|---|---|---|
| `gestor@redshield.com.br` | Gestor | Tudo, incluindo Financeiro e Planos |
| `professor@redshield.com.br` | Professor | Alunos, Agenda, Presença, Progresso |
| `aluno@redshield.com.br` | Aluno | Painel, Agenda, Progresso, Check-in |

## O que já está pronto

| Bloco | Tela |
|---|---|
| Login e controle de acesso por papel | `/entrar` |
| Painel com indicadores e ações rápidas | `/painel` |
| Cadastro, filtros, ficha e exportação de alunos | `/alunos` |
| Planos, valores e agenda de vencimentos | `/planos` |
| Receitas, despesas e resultado do mês | `/financeiro` |
| Presenças da aula: check-ins dos alunos, com correção pelo professor | `/presenca` |
| Quadro de horários semanal | `/agenda` |
| Check-in do aluno na aula do dia (vale na hora, sem confirmação) | `/checkin` |
| Distribuição de faixas e elegíveis à graduação | `/progresso` |
| Dados da academia, equipe, avisos automáticos e identidade visual | `/configuracoes` |

Tudo funciona em desktop, tablet e celular.

## Stack

React 19 · TypeScript (strict) · Vite 8 · Tailwind CSS v4 · React Router · Recharts · lucide-react

## Estrutura

```
.
├── app/                                        # front-end
│   └── src/
│       ├── app/         auth e store (ponto de costura com a API futura)
│       ├── components/  layout e biblioteca de UI
│       ├── data/        dados simulados e cálculos derivados
│       ├── lib/         formatação pt-BR e utilidades
│       ├── pages/       uma pasta por bloco do MVP
│       └── types/       contrato de domínio
├── PLANO_DESENVOLVIMENTO.md                    # plano completo, front e back
├── redshield_guia_identidade_visual.md         # guia de direção visual (provisório)
└── referencia_visual_conceitual.png            # referência conceitual (não é do REDSHIELD)
```

## Sobre a marca

O nome do produto e da academia é **REDSHIELD**. As cores, a tipografia e o símbolo (um escudo simples) são **provisórios**, usados para prototipar.
Se o REDSHIELD tiver identidade visual própria, ela substitui a atual. A imagem `referencia_visual_conceitual.png` é uma direção conceitual inicial e traz um símbolo
e fotos que **não** são do REDSHIELD; não a publique. Antes de divulgar, confirme a disponibilidade do nome e do domínio.
