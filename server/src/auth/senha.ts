import { createHash, randomBytes } from 'node:crypto'
import argon2 from 'argon2'

export const SENHA_MINIMA = 8

export const hashSenha = (senha: string) => argon2.hash(senha, { type: argon2.argon2id })

export async function confereSenha(hash: string, senha: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, senha)
  } catch {
    return false
  }
}

// Hash descartável usado quando o e-mail não existe, para o tempo de resposta não revelar se a conta existe.
let falso: Promise<string> | undefined
export function gastaTempoComoSeConferisse(senha: string) {
  falso ??= hashSenha('senha-que-ninguem-usa')
  return falso.then((h) => confereSenha(h, senha))
}

export function novoToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest()
