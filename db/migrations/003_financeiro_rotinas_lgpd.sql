-- Fases 5–8: cálculos com "hoje" injetado (fuso da academia), idempotência de avisos e anonimização (LGPD).
-- O runner de migrações envolve este arquivo em uma transação: não use begin/commit aqui.

-- As views v_aluno_pagamento e v_aluno_frequencia_30d usam current_date do servidor de banco (UTC), o que vira o dia
-- às 21h em Brasília. A API usa estas funções, que recebem o "hoje" já calculado no fuso da academia.
-- As views continuam existindo para consultas manuais.

create function aluno_status_pagamento(p_aluno uuid, p_hoje date) returns text
language sql stable as $$
  select case
    when exists (select 1 from cobranca c where c.aluno_id = p_aluno and c.status = 'aberta' and c.vencimento < p_hoje)
      then 'atrasado'
    when exists (select 1 from cobranca c where c.aluno_id = p_aluno and c.status = 'aberta' and c.vencimento <= p_hoje + 5)
      then 'vence_em_breve'
    else 'em_dia'
  end
$$;

-- Presentes / (aulas realizadas das turmas do aluno nos últimos 30 dias − justificadas). Sem linha em `presenca` = falta.
create function aluno_frequencia_30d(p_aluno uuid, p_hoje date) returns integer
language sql stable as $$
  select coalesce(
           round(100.0 * count(*) filter (where p.status = 'presente')
                 / nullif(count(ch.id) - count(*) filter (where p.status = 'justificado'), 0)),
           0)::int
    from aluno_turma at
    join aula au on au.turma_id = at.turma_id
    join v_aula_realizada ch on ch.aula_id = au.id
                            and ch.data >= p_hoje - 30
                            and ch.data <= p_hoje
                            and ch.data >= at.desde
                            and ch.data <= coalesce(at.ate, p_hoje)
    left join presenca p on p.chamada_id = ch.id and p.aluno_id = p_aluno
   where at.aluno_id = p_aluno
$$;

-- Avisos que não se prendem a uma cobrança (aniversário, ausência, resumo semanal) precisam de uma chave de idempotência:
-- `referencia` é o dia (aniversário), a segunda-feira da semana (ausência, resumo) ou o dia do envio.
alter table envio_email add column referencia date;
create unique index envio_email_referencia_idx on envio_email (tipo, destinatario, referencia)
  where cobranca_id is null and referencia is not null;

-- Aluno anonimizado a pedido do titular (LGPD). A linha continua existindo para não quebrar histórico financeiro e de presença.
alter table aluno add column anonimizado_em timestamptz;
