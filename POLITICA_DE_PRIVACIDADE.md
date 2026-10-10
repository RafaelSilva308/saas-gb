# Política de privacidade — REDSHIELD (modelo)

> **Rascunho técnico, não é parecer jurídico.** Os trechos entre `[colchetes]` dependem da academia (pendências E do `ROADMAP.md`). Um advogado deve revisar antes de publicar. Leva em conta a LGPD (Lei 13.709/2018).

**Controlador:** [razão social da academia], CNPJ [..], [endereço]. **Encarregado (DPO):** [nome], [e-mail de contato].

## 1. Quais dados tratamos

| Dado | Para quê | Base legal |
|---|---|---|
| Nome, e-mail, telefone, data de nascimento | Cadastro, contato, identificar o aluno | Execução de contrato |
| Responsável legal (nome e telefone), quando o aluno é menor | Falar com quem responde pelo menor | Execução de contrato; consentimento específico do responsável (art. 14) |
| Faixa, graus, histórico de graduação | Acompanhar a evolução | Execução de contrato |
| Presenças (check-in) | Frequência e graduação | Execução de contrato |
| Plano, cobranças, pagamentos | Cobrança e contabilidade | Execução de contrato; obrigação legal (fiscal) |
| E-mails enviados (tipo, data, status) | Comprovar avisos e evitar envio duplicado | Legítimo interesse |
| Foto / uso de imagem | Divulgação, **somente se autorizado** | Consentimento (revogável) |
| Endereço IP e registro de ações no sistema | Segurança e auditoria | Legítimo interesse |

Não tratamos dados de saúde nem dados biométricos no sistema. [Se a academia passar a pedir atestado ou lesões, tratar como dado sensível e rever esta seção.]

## 2. Com quem compartilhamos

- **Neon** (banco de dados) e **Railway** (servidor da aplicação): armazenam e processam os dados. [confirmar região/servidores]
- **Resend**: envia e-mails de cobrança e avisos (recebe nome, e-mail e o conteúdo da mensagem).
- Não vendemos nem cedemos dados a terceiros para marketing.
- Parte desses fornecedores fica fora do Brasil (transferência internacional, art. 33).

## 3. Por quanto tempo guardamos

- Cadastro e presenças: enquanto o aluno for ativo e [prazo] após a saída.
- Cobranças e pagamentos: [5] anos (obrigação fiscal/contábil).
- Registro de auditoria: [prazo].
- Cópias de segurança: [30] dias, criptografadas.

## 4. Seus direitos (art. 18)

Você pode pedir à academia: confirmação de que tratamos seus dados, **cópia** deles, correção, **anonimização ou eliminação**, informação sobre com quem compartilhamos e revogação de consentimento. Pedidos para [e-mail do encarregado]; resposta em até [15] dias.

O sistema tem as duas ferramentas prontas para o gestor atender:
- **Cópia dos dados:** `GET /api/v1/alunos/:id/exportacao` (JSON).
- **Eliminação:** `POST /api/v1/alunos/:id/anonimizar`. Apaga nome, contatos, nascimento, responsável e observações e encerra o acesso. **Mantém** valores de cobranças e lançamentos (obrigação fiscal) e a contagem de presenças, sem identificar a pessoa. Não tem volta.

## 5. Segurança

Senhas guardadas com Argon2id; conexão HTTPS; sessão em cookie `httpOnly`; cada academia só enxerga os próprios dados; ações sensíveis ficam registradas; cópias de segurança criptografadas.

## 6. Incidentes

Em caso de incidente que possa causar dano relevante, avisaremos os titulares e a ANPD em prazo razoável (art. 48).

## 7. Menores de idade

Dados de menores são tratados com consentimento de um responsável, que pode exercer os direitos acima por eles.

Última atualização: [data].
