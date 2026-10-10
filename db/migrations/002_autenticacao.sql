-- Autenticação própria (D8): senha com Argon2id, sessão em tabela, token de uso único para
-- recuperar senha e para convidar um aluno a criar o próprio acesso.
-- O runner de migrações (server/src/db/migrar.ts) envolve este arquivo em uma transação: não use begin/commit aqui.

alter table usuario add column senha_hash text;   -- null = convite ainda não aceito; não consegue entrar

-- O login só recebe e-mail e senha, então o e-mail precisa identificar uma pessoa em todo o sistema.
-- Troca o índice por academia (001) por um global. Se um dia uma pessoa precisar de acesso a duas
-- academias, o login passa a pedir também a academia (V2).
drop index usuario_email_idx;
create unique index usuario_email_idx on usuario (lower(email));

-- Guarda só o hash (sha256) do token: um vazamento do banco não entrega sessões válidas.
create table sessao (
  token_hash   bytea primary key,
  usuario_id   uuid not null references usuario(id) on delete cascade,
  criada_em    timestamptz not null default now(),
  expira_em    timestamptz not null,
  ip           inet,
  user_agent   text
);
create index sessao_usuario_idx on sessao (usuario_id);
create index sessao_expira_idx on sessao (expira_em);

create type finalidade_token as enum ('recuperar_senha', 'convite');

create table token_senha (
  token_hash   bytea primary key,
  usuario_id   uuid not null references usuario(id) on delete cascade,
  finalidade   finalidade_token not null,
  criado_em    timestamptz not null default now(),
  expira_em    timestamptz not null,
  usado_em     timestamptz
);
create index token_senha_usuario_idx on token_senha (usuario_id);
