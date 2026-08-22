import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { USUARIOS } from '@/data/mock'
import type { Papel, Usuario } from '@/types'

/* Autenticação SIMULADA — só para exercitar o controle de acesso do front.
   Na Fase 2 isto vira: POST /auth/login, token em cookie httpOnly e refresh.
   Nenhuma decisão de segurança real depende deste arquivo. */

const CHAVE = 'gb.sessao'

interface Ctx {
  usuario: Usuario | null
  entrar: (email: string, senha: string) => { ok: boolean; erro?: string }
  sair: () => void
  podeVer: (papeis: Papel[]) => boolean
}

const AuthCtx = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    try {
      const bruto = localStorage.getItem(CHAVE)
      return bruto ? (JSON.parse(bruto) as Usuario) : null
    } catch {
      return null
    }
  })

  const entrar = useCallback((email: string, senha: string) => {
    const achado = USUARIOS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!achado) return { ok: false, erro: 'Não encontramos esse e-mail. Confira e tente novamente.' }
    if (senha.length < 4) return { ok: false, erro: 'A senha precisa ter ao menos 4 caracteres.' }
    setUsuario(achado)
    try {
      localStorage.setItem(CHAVE, JSON.stringify(achado))
    } catch {
      /* ambiente sem storage: a sessão vive só na memória */
    }
    return { ok: true }
  }, [])

  const sair = useCallback(() => {
    setUsuario(null)
    try {
      localStorage.removeItem(CHAVE)
    } catch {
      /* nada a limpar */
    }
  }, [])

  const podeVer = useCallback((papeis: Papel[]) => !!usuario && papeis.includes(usuario.papel), [usuario])

  const valor = useMemo(() => ({ usuario, entrar, sair, podeVer }), [usuario, entrar, sair, podeVer])
  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

export const ROTULO_PAPEL: Record<Papel, string> = {
  gestor: 'Gestor',
  professor: 'Professor',
  aluno: 'Aluno',
}
