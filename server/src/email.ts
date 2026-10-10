export interface Mensagem {
  para: string
  assunto: string
  texto: string
}

export interface Mailer {
  /** Devolve o id da mensagem no provedor, quando houver. Lança erro se o envio falhar. */
  enviar(m: Mensagem): Promise<string | void>
}

/** Desenvolvimento: só escreve no log. */
export const mailerConsole: Mailer = {
  async enviar(m) {
    console.log(`[e-mail] para=${m.para} assunto="${m.assunto}"\n${m.texto}`)
  },
}

/** Resend (https://resend.com/docs/api-reference/emails/send-email). A chave vem do ambiente, nunca do código. */
export function mailerResend(apiKey: string, remetente: string, buscar: typeof fetch = fetch): Mailer {
  return {
    async enviar(m) {
      const r = await buscar('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: remetente, to: [m.para], subject: m.assunto, text: m.texto }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!r.ok) throw new Error(`Resend respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`)
      const corpo = (await r.json().catch(() => ({}))) as { id?: string }
      return corpo.id
    },
  }
}
