export interface Mensagem {
  para: string
  assunto: string
  texto: string
}

export interface Mailer {
  enviar(m: Mensagem): Promise<void>
}

/** Desenvolvimento: só escreve no log. Troque por Resend na Fase 7 (ver ROADMAP). */
export const mailerConsole: Mailer = {
  async enviar(m) {
    console.log(`[e-mail] para=${m.para} assunto="${m.assunto}"\n${m.texto}`)
  },
}
