import { Link } from 'react-router-dom'
import { Lock, MapPinOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'

function Aviso({
  icone,
  titulo,
  mensagem,
}: {
  icone: React.ReactNode
  titulo: string
  mensagem: string
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-gb-gray-100 text-gb-gray-500">{icone}</span>
      <h1 className="gb-title text-3xl text-gb-ink">{titulo}</h1>
      <p className="max-w-md text-sm text-gb-gray-500">{mensagem}</p>
      <Link to="/painel">
        <Button variante="secundaria">Voltar ao painel</Button>
      </Link>
    </div>
  )
}

export const SemAcesso = () => (
  <Aviso
    icone={<Lock className="size-6" />}
    titulo="Acesso restrito"
    mensagem="Seu perfil não tem permissão para esta área. Fale com o gestor da academia se precisar de acesso."
  />
)

export const NaoEncontrado = () => (
  <Aviso
    icone={<MapPinOff className="size-6" />}
    titulo="Página não encontrada"
    mensagem="O endereço acessado não existe ou foi movido. Volte ao painel para continuar."
  />
)
