import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAuth } from '@/app/auth'
import type { Papel } from '@/types'

export function AppLayout() {
  const { usuario } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const local = useLocation()

  if (!usuario) return <Navigate to="/entrar" state={{ de: local.pathname }} replace />

  return (
    <div className="min-h-screen bg-rs-gray-100">
      <Sidebar aberta={menuAberto} aoFechar={() => setMenuAberto(false)} />
      <div className="lg:pl-64">
        <Topbar aoAbrirMenu={() => setMenuAberto(true)} />
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** Guarda de rota por papel. Reflete o controle que o back-end fará de verdade. */
export function ExigePapel({ papeis, children }: { papeis: Papel[]; children: React.ReactNode }) {
  const { usuario } = useAuth()
  if (!usuario) return <Navigate to="/entrar" replace />
  if (!papeis.includes(usuario.papel)) return <Navigate to="/sem-acesso" replace />
  return <>{children}</>
}
