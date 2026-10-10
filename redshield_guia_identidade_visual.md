# REDSHIELD — guia de direção visual do sistema de gestão

## Escopo e observação importante

Este guia descreve a linguagem visual **provisória** do sistema de gestão do REDSHIELD. Ela foi prototipada a partir de uma direção conceitual de mercado
(academias de jiu-jitsu de tradição institucional): vermelho para ação, azul para estrutura, tipografia condensada em caixa alta e diagonais como acento.
As cores abaixo são **aproximações para prototipação**, **não** a identidade oficial do REDSHIELD.

**Se o REDSHIELD tiver identidade própria** (logotipo, cores, tipografia, manual de marca), ela substitui este guia. O símbolo atual do sistema
(`app/src/components/Logo.tsx`) é um escudo simples e provisório.

O arquivo [`referencia_visual_conceitual.png`](./referencia_visual_conceitual.png) é uma **direção conceitual** usada no início do projeto. Ele traz um símbolo e uma
fotografia que **não são do REDSHIELD** e não devem ser publicados, reproduzidos nem tratados como material da academia.

## Essência da identidade

A identidade deve comunicar uma combinação de **legado, disciplina, comunidade, método, progresso e excelência**. O tom não é agressivo nem excessivamente “fitness”; é institucional, humano e orientado à jornada de longo prazo do aluno. A promessa visual é de uma organização consistente, acolhedora e profissional, na qual cada pessoa sabe onde está e qual é o próximo passo.

> Princípio de produto: transformar a experiência da academia em uma jornada clara de evolução, pertencimento e organização.

## Paleta visual provisória

| Função | Cor aproximada | Uso recomendado no SaaS |
|---|---|---|
| Vermelho institucional | `#D40000` a `#E00000` | CTA principal, alertas importantes, progresso crítico e ações de conversão |
| Azul institucional | `#1764A8` a `#246DB1` | Navegação, cabeçalho, links, indicadores de confiança e estados ativos |
| Branco | `#FFFFFF` | Fundo principal, cartões, áreas de respiro e contraste |
| Preto | `#111111` a `#1A1A1A` | Títulos, números, textos de maior importância e ícones fortes |
| Cinza claro | `#F2F4F6` | Fundo de seções, tabelas, separadores e estados neutros |
| Cinza médio | `#667085` | Texto auxiliar, metadados e informações secundárias |

Use o **vermelho com parcimônia**. Ele deve chamar atenção para uma decisão importante, não pintar toda a interface. O azul pode estruturar a navegação, enquanto branco, cinza e preto sustentam legibilidade e sensação de ordem.

## Tipografia e hierarquia

A referência utiliza uma linguagem sans-serif limpa, com títulos de aparência condensada, pesada e frequentemente em caixa alta. Para implementação, uma combinação segura seria uma fonte sans-serif condensada ou semicon­densada para títulos e uma sans-serif neutra para leitura contínua. O princípio é mais importante que a fonte exata: títulos compactos e assertivos; corpo confortável; números de métricas grandes; labels curtos.

A hierarquia sugerida é: título de página em preto e caixa alta; subtítulo explicativo em cinza escuro; números de indicadores em preto ou azul; ação primária em vermelho com texto branco; ação secundária em branco com borda azul ou vermelha.

## Linguagem de interface

A interface deve usar verbos diretos e linguagem acolhedora. Exemplos adequados são “Ver agenda”, “Registrar presença”, “Acompanhar progresso”, “Adicionar aluno” e “Agendar aula”. Evite jargão técnico, excesso de abreviações e mensagens com tom punitivo. O sistema deve refletir a ideia de que a evolução acontece com consistência e apoio da comunidade.

## Componentes recomendados

| Componente | Direção visual |
|---|---|
| Navegação lateral | Azul institucional, ícones lineares brancos, item ativo com realce vermelho ou fundo azul mais claro |
| Botão primário | Vermelho sólido, texto branco, alto contraste, formato retangular com leve arredondamento |
| Botão secundário | Fundo branco, contorno azul ou vermelho, texto escuro ou institucional |
| Cards | Branco sobre fundo cinza muito claro, borda sutil, sombra mínima e títulos curtos |
| Métricas | Número grande, label pequena, variação percentual discreta e ícone funcional |
| Agenda | Linhas claras, horários bem alinhados e destaque azul para a próxima aula |
| Progresso de faixa | Visual circular ou linear simples; usar as cores das faixas com cuidado e legenda explícita |
| Alertas | Vermelho apenas para urgência; azul para informação; verde neutro somente quando necessário para confirmação |
| Fotografia | Preto e branco ou baixa saturação, foco em orientação, treino, respeito e comunidade |

## Elementos gráficos

A linguagem visual observada emprega diagonais, recortes angulares e blocos geométricos. No SaaS, esses elementos devem funcionar como **acentos**, em cabeçalhos, banners de progresso, divisores ou ilustrações de onboarding. Use formas abstratas e originais; não redesenhe o monograma, o escudo, o selo ou o logotipo oficial.

Uma boa regra é manter a maior parte do produto limpa e reservar as diagonais para momentos de destaque: início da jornada, conquista de graduação, chamada para aula experimental.

## Fotografia e conteúdo visual

Prefira imagens reais de alunos e professores em situações de aprendizado, aquecimento, organização da aula e interação entre gerações. O tratamento pode ser monocromático ou com saturação reduzida, com detalhes vermelhos e azuis aplicados na interface. Evite imagens de luta agressiva, poses exageradas, estética de MMA, excesso de músculos, sangue ou composição genérica de banco de imagens.

## Aplicação ao SaaS

A tela inicial ideal deve mostrar imediatamente: alunos ativos, próxima aula, presença recente, progresso de faixas e ações rápidas. A arquitetura visual deve reduzir ansiedade operacional do professor: menos elementos decorativos, mais previsibilidade, status claros e caminhos curtos para as tarefas diárias.

Para alunos e responsáveis, o produto pode enfatizar calendário, presença, evolução e próximos objetivos. Para professores, deve priorizar chamada, organização das turmas, observações de treino e acompanhamento individual. Para gestores, deve apresentar indicadores, inadimplência, ocupação de turmas e retenção sem perder o tom humano da marca.

## O que fazer e o que evitar

| Fazer | Evitar |
|---|---|
| Usar vermelho e azul como sistema funcional de prioridade | Transformar toda a interface em vermelho e azul saturados |
| Criar uma hierarquia forte e previsível | Encher o dashboard com widgets sem prioridade |
| Usar fotos humanas, reais e respeitosas | Usar clichês agressivos de combate |
| Aplicar diagonais como detalhe editorial | Reproduzir símbolos ou layouts de terceiros |
| Manter CTAs curtos e orientados a ação | Usar slogans longos em cada tela |
| Garantir contraste e foco visível | Depender apenas de cor para indicar estado |

## Síntese executiva

A direção adotada é **institucional, esportiva e humana**: superfícies brancas, navegação azul, ações vermelhas, tipografia sans-serif forte, fotografia documental com baixa saturação e geometria diagonal usada com moderação. O resultado deve parecer uma ferramenta confiável para uma comunidade disciplinada, não um aplicativo de academia genérico.
