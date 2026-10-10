export interface Config {
  ambiente: 'development' | 'production' | 'test'
  databaseUrl: string
  porta: number
  host: string
  /** Pasta do front compilado (app/dist). Se não existir, a API sobe sem servir o front. */
  webDist: string | undefined
  sessaoDias: number
  /** Cookie `Secure`: obrigatório em produção (HTTPS). */
  cookieSeguro: boolean
  /** URL pública usada nos links de e-mail (convite, recuperação de senha). */
  urlPublica: string
  /** Tentativas por minuto, por IP, nas rotas de login e senha. */
  limiteLogin: number
}

export function lerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const ambiente = (env.NODE_ENV ?? 'development') as Config['ambiente']
  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL não definida.')
  const porta = Number(env.PORT ?? 3000)
  return {
    ambiente,
    databaseUrl,
    porta,
    host: env.HOST ?? '0.0.0.0',
    webDist: env.WEB_DIST,
    sessaoDias: Number(env.SESSAO_DIAS ?? 14),
    cookieSeguro: ambiente === 'production',
    urlPublica: env.URL_PUBLICA ?? `http://localhost:${porta}`,
    limiteLogin: Number(env.LIMITE_LOGIN ?? 10),
  }
}
