-- =============================================================================
-- Modelo de dados — SaaS de gestão para academia de jiu-jitsu
-- PostgreSQL 15+ (testado em 16).
--
-- Decisões que sustentam este arquivo (explicadas em BANCO_DE_DADOS.md):
--   * dinheiro em centavos (integer), nunca float;
--   * academia_id em toda tabela de negócio (multi-tenant desde o dia 1);
--   * dado derivado NÃO é gravado (inadimplência, frequência, faltas, faixa etária);
--   * histórico é append-only (graduação, auditoria, envio de e-mail).
-- =============================================================================

begin;

-- ----------------------------------------------------------------- tipos ----

create type papel            as enum ('gestor', 'professor', 'aluno');
create type faixa            as enum ('branca', 'cinza', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'marrom', 'preta');
create type status_aluno     as enum ('ativo', 'inativo', 'experimental');
create type periodicidade    as enum ('mensal', 'trimestral', 'semestral', 'anual');
create type status_presenca  as enum ('presente', 'ausente', 'justificado');
-- Quem registrou a presença: o professor na chamada, ou o próprio aluno pelo check-in.
create type origem_presenca  as enum ('professor', 'aluno');
-- "atrasada" não existe aqui de propósito: é uma cobrança 'aberta' com vencimento no passado.
create type status_cobranca  as enum ('aberta', 'paga', 'cancelada');
create type tipo_transacao   as enum ('receita', 'despesa');
create type metodo_pagamento as enum ('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia');
create type tipo_aviso       as enum ('vencimento', 'inadimplencia', 'aniversario', 'ausencia', 'resumo_semanal');
create type status_envio     as enum ('pendente', 'enviado', 'falhou');

-- ------------------------------------------------------------- academia ----

create table academia (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  cnpj       text,
  telefone   text,
  email      text,
  endereco   text,
  fuso       text not null default 'America/Sao_Paulo',
  criado_em  timestamptz not null default now()
);

-- --------------------------------------------------------------- plano ----

create table plano (
  id               uuid primary key default gen_random_uuid(),
  academia_id      uuid not null references academia(id),
  nome             text not null,
  descricao        text not null default '',
  valor_centavos   integer not null check (valor_centavos >= 0),
  periodicidade    periodicidade not null default 'mensal',
  aulas_por_semana smallint check (aulas_por_semana > 0),   -- null = ilimitado
  ativo            boolean not null default true,
  unique (academia_id, nome)
);

-- --------------------------------------------------------------- aluno ----

create table aluno (
  id                    uuid primary key default gen_random_uuid(),
  academia_id           uuid not null references academia(id),
  nome                  text not null,
  email                 text,
  telefone              text,
  nascimento            date,
  -- faixa/graus = estado ATUAL. O histórico vive em `graduacao`; o trigger abaixo mantém os dois alinhados.
  faixa                 faixa not null default 'branca',
  graus                 smallint not null default 0 check (graus between 0 and 6),
  status                status_aluno not null default 'experimental',
  matricula_em          date not null default current_date,
  plano_id              uuid references plano(id),
  vencimento_dia        smallint not null default 10 check (vencimento_dia between 1 and 28),
  responsavel_nome      text,
  responsavel_telefone  text,
  observacoes           text,
  foto_url              text,
  -- LGPD: obrigatório registrar consentimento (do responsável, no caso de menor) e autorização de imagem.
  consentimento_em      timestamptz,
  consentimento_por     text,
  uso_imagem_autorizado boolean not null default false,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  check ((responsavel_nome is null) = (responsavel_telefone is null))
);
create index aluno_academia_status_idx on aluno (academia_id, status);
create index aluno_plano_idx on aluno (plano_id);

-- ------------------------------------------------------------- usuario ----
-- Quem entra no sistema. Se usar Supabase Auth, `id` = auth.users.id e não há senha aqui.
-- Se usar auth próprio (Fastify), adicionar coluna senha_hash (Argon2id).

create table usuario (
  id             uuid primary key default gen_random_uuid(),
  academia_id    uuid not null references academia(id),
  nome           text not null,
  email          text not null,
  papel          papel not null,
  aluno_id       uuid unique references aluno(id),        -- só para papel = 'aluno'
  ativo          boolean not null default true,
  ultimo_acesso  timestamptz,
  criado_em      timestamptz not null default now(),
  check ((papel = 'aluno') = (aluno_id is not null))
);
create unique index usuario_email_idx on usuario (academia_id, lower(email));

-- --------------------------------------------------------------- turma ----

create table turma (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academia(id),
  nome         text not null,
  professor_id uuid references usuario(id),
  faixa_etaria text not null default 'Adulto',
  nivel        text not null default 'Livre',
  -- Substitui a regra hardcoded do protótipo (ids 't3'/'t4'): turma infantil exige responsável no aluno.
  infantil     boolean not null default false,
  cor          text not null default '#1764a8',
  ativa        boolean not null default true,
  unique (academia_id, nome)
);

-- Quem pertence a qual turma. O protótipo NÃO tinha esse vínculo (inferia pela existência de responsável).
create table aluno_turma (
  aluno_id  uuid not null references aluno(id) on delete cascade,
  turma_id  uuid not null references turma(id) on delete cascade,
  desde     date not null default current_date,
  ate       date,
  primary key (aluno_id, turma_id),
  check (ate is null or ate >= desde)
);
create index aluno_turma_turma_idx on aluno_turma (turma_id);

-- ---------------------------------------------------------------- aula ----
-- Horário RECORRENTE do quadro ("segunda, 19h"). A ocorrência concreta é a `chamada`.

create table aula (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academia(id),
  turma_id     uuid not null references turma(id),
  titulo       text not null,
  dia_semana   smallint not null check (dia_semana between 0 and 6),   -- 0 = domingo
  inicio       time not null,
  fim          time not null,
  capacidade   integer not null check (capacidade > 0),
  local        text not null default 'Tatame 1',
  ativa        boolean not null default true,
  check (fim > inicio)
);
create index aula_academia_dia_idx on aula (academia_id, dia_semana);

-- ------------------------------------------------------ chamada/presença ----

-- Ocorrência concreta de uma aula em uma data. Não há "chamada do professor": a linha nasce no primeiro check-in
-- (ou quando o professor cancela a aula / corrige alguém). Quem não fez check-in e não foi marcado conta como falta.
create table chamada (
  id             uuid primary key default gen_random_uuid(),
  academia_id    uuid not null references academia(id),
  aula_id        uuid not null references aula(id),
  data           date not null,
  -- Feriado ou aula que não aconteceu: não entra no cálculo de frequência de ninguém e recusa check-in.
  cancelada      boolean not null default false,
  cancelada_por  uuid references usuario(id),
  motivo         text,
  criado_em      timestamptz not null default now(),
  unique (aula_id, data),
  check (cancelada or cancelada_por is null)
);
create index chamada_academia_data_idx on chamada (academia_id, data);

-- Só existe linha quando alguém agiu: o aluno (check-in = presente) ou o professor (corrigindo para qualquer status).
-- AUSÊNCIA PADRÃO = falta de linha. Para o aluno de uma aula realizada sem linha, a falta é calculada, não gravada.
create table presenca (
  chamada_id     uuid not null references chamada(id) on delete cascade,
  aluno_id       uuid not null references aluno(id),
  status         status_presenca not null,
  -- 'aluno' = check-in feito pelo próprio aluno, vale na hora, sem confirmação (decisão de produto da v1).
  -- 'professor' = o professor criou ou corrigiu o registro; a partir daí o aluno não mexe mais nele.
  origem         origem_presenca not null default 'professor',
  registrado_em  timestamptz not null default now(),
  registrado_por uuid references usuario(id),             -- quem gravou: o próprio aluno, ou o professor
  observacao     text,                                    -- motivo de uma correção do professor
  primary key (chamada_id, aluno_id)
);
create index presenca_aluno_idx on presenca (aluno_id);
create index presenca_origem_idx on presenca (origem) where origem = 'aluno';

-- ------------------------------------------------------------ graduação ----

create table graduacao (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academia(id),
  aluno_id     uuid not null references aluno(id),
  faixa        faixa not null,
  graus        smallint not null default 0 check (graus between 0 and 6),
  data         date not null default current_date,
  concedida_por uuid references usuario(id),
  observacao   text,
  criado_em    timestamptz not null default now()
);
create index graduacao_aluno_idx on graduacao (aluno_id, data desc, criado_em desc);

-- Gravar uma graduação atualiza o estado atual do aluno na mesma transação.
create function aplicar_graduacao() returns trigger language plpgsql as $$
begin
  update aluno set faixa = new.faixa, graus = new.graus, atualizado_em = now()
   where id = new.aluno_id;
  return new;
end $$;
create trigger graduacao_aplica after insert on graduacao
  for each row execute function aplicar_graduacao();

-- ------------------------------------------------------------ financeiro ----

create table categoria_financeira (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academia(id),
  tipo         tipo_transacao not null,
  nome         text not null,
  ativa        boolean not null default true,
  unique (academia_id, tipo, nome)
);

-- O que o aluno DEVE. Separada de `transacao` (o que ENTROU): sem isso não há relatório de inadimplência confiável.
create table cobranca (
  id              uuid primary key default gen_random_uuid(),
  academia_id     uuid not null references academia(id),
  aluno_id        uuid not null references aluno(id),
  plano_id        uuid references plano(id),
  competencia     date not null check (extract(day from competencia) = 1),   -- sempre dia 1 do mês
  vencimento      date not null,
  valor_centavos  integer not null check (valor_centavos >= 0),
  status          status_cobranca not null default 'aberta',
  pago_em         date,
  criado_em       timestamptz not null default now(),
  unique (aluno_id, competencia),
  check ((status = 'paga') = (pago_em is not null))
);
create index cobranca_aberta_idx on cobranca (academia_id, vencimento) where status = 'aberta';

create table transacao (
  id              uuid primary key default gen_random_uuid(),
  academia_id     uuid not null references academia(id),
  tipo            tipo_transacao not null,
  categoria_id    uuid not null references categoria_financeira(id),
  descricao       text not null,
  valor_centavos  integer not null check (valor_centavos > 0),
  data            date not null,
  metodo          metodo_pagamento not null default 'pix',
  aluno_id        uuid references aluno(id),
  cobranca_id     uuid unique references cobranca(id),     -- uma transação quita no máximo uma cobrança
  conciliada      boolean not null default false,
  criado_por      uuid references usuario(id),
  criado_em       timestamptz not null default now()
);
create index transacao_academia_data_idx on transacao (academia_id, data desc);

-- --------------------------------------------------------------- avisos ----
-- "Avisos automáticos" da tela de Configurações + registro do que já foi enviado
-- (idempotência: a rotina diária não pode mandar o mesmo e-mail duas vezes).

create table config_aviso (
  academia_id  uuid not null references academia(id),
  tipo         tipo_aviso not null,
  ativo        boolean not null default true,
  primary key (academia_id, tipo)
);

create table envio_email (
  id            uuid primary key default gen_random_uuid(),
  academia_id   uuid not null references academia(id),
  tipo          tipo_aviso not null,
  aluno_id      uuid references aluno(id),
  cobranca_id   uuid references cobranca(id),
  destinatario  text not null,
  status        status_envio not null default 'pendente',
  provedor_id   text,                                   -- id devolvido pelo provedor de e-mail
  erro          text,
  criado_em     timestamptz not null default now()
);
-- No máximo um aviso de cada tipo por cobrança.
create unique index envio_email_cobranca_idx on envio_email (tipo, cobranca_id) where cobranca_id is not null;

-- ------------------------------------------------------------- auditoria ----

create table log_auditoria (
  id             bigint generated always as identity primary key,
  academia_id    uuid not null references academia(id),
  usuario_id     uuid references usuario(id),
  acao           text not null,                 -- ex.: 'aluno.atualizar', 'transacao.remover'
  entidade       text not null,
  entidade_id    uuid,
  dados_antes    jsonb,
  dados_depois   jsonb,
  ip             inet,
  criado_em      timestamptz not null default now()
);
create index log_auditoria_entidade_idx on log_auditoria (academia_id, entidade, entidade_id);

-- ================================================================ views ====
-- Tudo que o protótipo gravava no aluno mas é, na verdade, cálculo.

-- Situação de pagamento por aluno (regra: atrasado = cobrança aberta vencida; em breve = vence em até 5 dias).
create view v_aluno_pagamento as
select a.id as aluno_id,
       case
         when exists (select 1 from cobranca c where c.aluno_id = a.id and c.status = 'aberta' and c.vencimento < current_date)
           then 'atrasado'
         when exists (select 1 from cobranca c where c.aluno_id = a.id and c.status = 'aberta' and c.vencimento <= current_date + 5)
           then 'vence_em_breve'
         else 'em_dia'
       end as status_pagamento
  from aluno a;

-- Aula REALIZADA = não cancelada e com pelo menos um presente (evidência de que aconteceu). Sem a chamada do professor
-- não há outro sinal: uma aula em que ninguém fez check-in e ninguém foi marcado é tratada como não realizada,
-- para que um feriado esquecido não gere falta para a turma inteira.
create view v_aula_realizada as
select ch.*
  from chamada ch
 where not ch.cancelada
   and exists (select 1 from presenca p where p.chamada_id = ch.id and p.status = 'presente');

-- Frequência dos últimos 30 dias = presentes / (aulas realizadas das turmas do aluno − justificadas).
-- Sem linha em `presenca` numa aula realizada = falta. Justificada sai do cálculo (nem presença, nem falta).
create view v_aluno_frequencia_30d as
select a.id as aluno_id,
       coalesce(
         round(100.0 * count(*) filter (where p.status = 'presente')
               / nullif(count(ch.id) - count(*) filter (where p.status = 'justificado'), 0)),
         0)::int as frequencia_30d
  from aluno a
  left join aluno_turma at on at.aluno_id = a.id
  left join aula au        on au.turma_id = at.turma_id
  left join v_aula_realizada ch
                           on ch.aula_id = au.id
                          and ch.data >= current_date - 30
                          and ch.data >= at.desde
                          and ch.data <= coalesce(at.ate, current_date)
  left join presenca p     on p.chamada_id = ch.id and p.aluno_id = a.id
 group by a.id;

-- Resultado financeiro por mês.
create view v_fluxo_mensal as
select academia_id,
       date_trunc('month', data)::date as mes,
       sum(valor_centavos) filter (where tipo = 'receita') as receita_centavos,
       sum(valor_centavos) filter (where tipo = 'despesa') as despesa_centavos
  from transacao
 group by academia_id, date_trunc('month', data);

commit;
