export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly campos?: Record<string, string>,
  ) {
    super(mensagem)
  }
}

export const naoAutenticado = () => new ErroApi(401, 'nao_autenticado', 'Entre para continuar.')
export const semPermissao = (msg = 'Você não tem permissão para isso.') => new ErroApi(403, 'sem_permissao', msg)
export const naoEncontrado = (o = 'Registro') => new ErroApi(404, 'nao_encontrado', `${o} não encontrado.`)
export const conflito = (codigo: string, msg: string) => new ErroApi(409, codigo, msg)
export const invalido = (msg: string, campos?: Record<string, string>) => new ErroApi(422, 'regra_de_negocio', msg, campos)
