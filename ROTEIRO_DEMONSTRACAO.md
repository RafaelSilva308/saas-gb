# Roteiro de demonstração — validação com o professor

**Objetivo:** não é apresentar o sistema. É descobrir, em ~35 minutos (ou 15, na versão curta abaixo), **o que está errado nele para este professor**, antes de gastar semanas
construindo o back-end em cima de suposições. Cada bloco termina com perguntas que destravam uma decisão do [`ROADMAP.md`](./ROADMAP.md).

**Regra de ouro: quem mexe é o professor, não você.** Se ele só assiste, vai dizer "ficou bonito" e você não aprende nada.
Entregue o celular ou o notebook e peça para ele fazer tarefas reais. Observe onde ele hesita.

## Antes de começar (10 minutos de preparação)

- [ ] Abrir o sistema **no celular do professor** e também em um notebook. A chamada é a tela mais importante e é usada de pé, com o dedo.
- [ ] Testar o login de antemão. Entrar como `gestor@gb.com.br` / `treino123` (clique em uma linha de "Acessos de demonstração" — ela preenche e-mail e senha).
- [ ] Ter este arquivo aberto para anotar as respostas (tabela no final).
- [ ] Levar uma folha/ planilha dele de verdade (mensalidades, lista de chamada) para comparar com a tela.

## Avisos que você precisa dar no início (2 minutos)

Diga exatamente isto, com as suas palavras:

1. **"Todos os nomes, valores e presenças aqui são inventados."** Se ele estranhar um aluno ou um número, é por isso.
2. **"Nada do que você cadastrar fica salvo."** Se recarregar a página, volta tudo ao início.
3. **"Ainda não é o sistema; é o desenho dele."** Quanto mais ele criticar agora, mais barato é consertar.
4. **"Não existem respostas erradas."** Se ele não entendeu uma tela, o problema é da tela.

## Versão curta (15 minutos)

Se só houver 15 minutos, faça apenas isto, nesta ordem, e agende o restante para outro dia:

| Min | Bloco | Só estas perguntas |
|---|---|---|
| 2 | Avisos iniciais | Os 4 avisos acima |
| 2 | 1. Painel | Os 4 números estão certos? **E12** |
| 5 | 2. Chamada no celular | **E5**, **E8** |
| 3 | 3. Alunos (só "Em aberto" + cadastro) | **E6**, **E7** |
| 2 | 4. Financeiro (só planos e forma de pagamento) | **E2**, **E3** |
| 1 | 7. Fechamento | Perguntas 1 e 6 |

Ficam para a segunda sessão: Agenda, Progresso (**E1**, o critério de graduação), categorias financeiras (**E4**) e papéis.
Mas **E1 não pode esperar muito**: ele muda a tela de Progresso e a regra de elegibilidade.

## Roteiro completo (~35 minutos)

### 1. Painel (3 min) — entrando como Gestor

**O que mostrar:** quatro números no topo (Alunos ativos, Presença 30 dias, Receita do mês, Novas matrículas), alerta de inadimplentes,
agenda dos próximos 3 dias, ocupação das turmas.

**Peça para ele:** *"Sem eu falar nada, me diga o que cada número significa."*

**Perguntas:**
- Esses são os 4 números que você olha de manhã? Falta algum? Algum não interessa?
- O que você perguntaria ao sistema que ele não responde? *(quem sumiu? quanto vou receber esta semana?)*
- **[E12]** O que você faz **todo dia** e quantos cliques isso leva a partir daqui?

### 2. Chamada pelo celular (5 min) — o teste mais importante

**Tarefa:** *"São 19h de segunda. Faça a chamada da turma de Fundamentos."* Menu **Presença** → escolher a aula → tocar em Presente / Justificado / Ausente
em cada aluno → **Fechar chamada**. Mostre também o botão **Marcar todos**.

**Observe:** consegue fazer de pé, com uma mão? Erra o botão? Demora quanto por aluno?

**Perguntas:**
- A lista de alunos está certa para essa turma? Quem **deveria** estar nela e não está? *(o protótipo mostra todos os alunos ativos que parecem da faixa etária — não existe vínculo real aluno ↔ turma)*
- **[E5]** Como você decide quem pertence a qual turma? Um aluno pode treinar em mais de uma? Criança só vai em turma infantil?
- **[E8]** Tem internet no tatame? Se cair o sinal no meio da chamada, o que você espera que aconteça?
- **[E11]** Quando há feriado ou aula cancelada, como você registra hoje?
- Justificado: o que significa na sua academia? Conta como falta?

### 3. Alunos e a ficha (5 min)

**Tarefa 1:** *"Ache todos os alunos que estão devendo."* (aba **Em aberto**). Depois: *"Abra a ficha de um deles."*
**Tarefa 2:** *"Cadastre um aluno novo."* (**Adicionar aluno**). Mostre o botão **Exportar**.

**Perguntas:**
- **[E6]** Os campos do cadastro bastam? O que falta — CPF, endereço, contato de emergência, atestado médico, foto?
- **[E7]** Para criança, quem assina a autorização? É no papel hoje? Usa autorização de imagem?
- Na ficha: a "jornada de graduação" e o histórico de presença são o que você consultaria? Falta alguma informação sobre o aluno?
- Exportar: você exportaria para quê? Para qual programa?

### 4. Planos e Financeiro (6 min)

**Tarefa:** em **Planos**, *"Esses planos refletem o que você vende?"*. Em **Financeiro**, *"Registre uma despesa de aluguel"* e depois *"quanto sobrou este mês?"*.

**Perguntas:**
- **[E2]** Quais são seus planos de verdade (nomes, valores)? Existe trancamento, desconto para irmãos/família, taxa de matrícula, aula experimental?
- **[E3]** Como o aluno paga hoje: Pix na chave, boleto, cartão, dinheiro? Todo mundo vence no mesmo dia ou cada um no seu?
- **[E4]** Quais são suas categorias de receita e de despesa? *(o protótipo mostra uma lista inventada)*
- Quando um aluno paga, como você anota? E quando ele atrasa, como você cobra? *(WhatsApp? pessoalmente?)*
- **Pergunta de decisão de produto (V6):** *"Se o sistema gerasse o Pix e desse baixa sozinho, isso valeria uma taxa por pagamento?"*

### 5. Agenda e Progresso (4 min)

**Tarefa:** *"Mude o horário de uma aula"* (Agenda). Depois abra **Progresso**, aba **Elegíveis à graduação**.

**Perguntas:**
- **[E1]** Quem está na lista de elegíveis **faz sentido**? Qual é a regra real: tempo mínimo por faixa, frequência mínima, graus, exame, decisão sua?
  *(o protótipo usa 12 meses + 70% de frequência para qualquer faixa — isso certamente está errado para faixas mais altas)*
- Você registra graus (listras) no sistema? Quem aprova a graduação?

### 6. Visão de cada papel (3 min)

Saia (botão sair) e entre como **`professor@gb.com.br`**. Mostre que Financeiro e Planos somem.

**Perguntas:**
- **[V5]** Os alunos ou responsáveis vão querer entrar para ver a própria presença e evolução? Ou a v1 é só você e os professores?
- Quem mais da academia vai usar? Recepção? Outros professores? Eles podem ver o financeiro?
- Há algo que o professor **não** deve ver além do financeiro?

### 7. Fechamento (4 min)

Pergunte, em voz alta, nesta ordem:

1. **"Se você tivesse que escolher só **uma** tela para usar amanhã, qual seria?"** *(mostra o que realmente resolve a dor dele)*
2. **"O que mais te incomoda hoje na sua rotina que o sistema ainda não toca?"**
3. **"Qual dessas telas você usaria **todo dia**, e qual abriria uma vez por mês?"**
4. **[E10]** *"Você tem uma planilha hoje? Posso ver como ela é? Quantos anos de histórico?"*
5. **[E13]** *"Você toparia usar o sistema em paralelo com a planilha por algumas semanas?"*
6. *"Em uma escala de 0 a 10, qual a chance de você usar isto no lugar do que faz hoje? O que faria essa nota subir?"*

## Registro das respostas

Preencha durante a sessão. Cada linha destrava uma decisão do roadmap.

| ID | Resposta do professor | Muda o quê |
|---|---|---|
| E1 — critério de graduação | | Tela Progresso / regra de elegibilidade |
| E2 — planos reais | | Cadastro de planos |
| E3 — forma e dia de pagamento | | Geração de cobranças, e-mail |
| E4 — categorias financeiras | | Financeiro |
| E5 — aluno × turma | | Modelo (`aluno_turma`) e chamada |
| E6 — campos do cadastro | | Cadastro de aluno |
| E7 — menores / autorização | | Consentimento (LGPD) |
| E8 — internet no tatame | | Chamada offline na v1? |
| E9 — avisos por e-mail | | Rotinas automáticas |
| E10 — planilha atual | | Importação |
| E11 — feriados / aula cancelada | | Chamada / agenda |
| E12 — tarefa diária em ≤ 2 cliques | | Painel |
| E13 — piloto em paralelo | | Fase 10 |
| V5 — aluno entra no sistema? | | Escopo da v1 |
| V6 — cobrança automática vale a taxa? | | Escopo da v1 |
| Nota 0–10 de adoção + o que sobe a nota | | Prioridades |

## Depois da sessão (mesmo dia)

- [ ] Transcrever as respostas na tabela acima e anexar ao repositório.
- [ ] Marcar o checklist da seção 5 do [`PLANO_DESENVOLVIMENTO.md`](./PLANO_DESENVOLVIMENTO.md).
- [ ] Listar o que ele pediu para **mudar** e o que ele pediu para **incluir**; só o primeiro entra na Fase 1 do roadmap.
- [ ] Se a nota de adoção for **menor que 7**, não começar o back-end. Entender o que falta antes.
- [ ] Levar V1 (marca) para a liderança, se ainda não resolvido.

## Armadilhas comuns

- **Defender o sistema.** Se ele criticar, anote, não explique. Cada explicação é uma pergunta que você deixou de fazer.
- **Aceitar elogio como validação.** "Está bonito" não vale nada. "Eu faria assim em vez disso" vale muito.
- **Levar mais de uma pessoa decidindo.** Se houver um sócio ou gerente, coloque-o na sessão; senão o professor aprova e o dono veta depois.
- **Esquecer que tudo é fictício.** Se ele cadastrar um aluno e a página recarregar, avise antes que ele ache que perdeu trabalho real.
