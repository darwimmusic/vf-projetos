import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ClienteLayout } from '@/components/layout/ClienteLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'

import RootRedirect from '@/pages/RootRedirect'
import NotFound from '@/pages/NotFound'

const Login = lazy(() => import('@/pages/auth/Login'))
const AcceptInvite = lazy(() => import('@/pages/auth/AcceptInvite'))

const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const AdminClientes = lazy(() => import('@/pages/admin/Clientes'))
const AdminClienteDetail = lazy(() => import('@/pages/admin/ClienteDetail'))
const AdminProjetos = lazy(() => import('@/pages/admin/Projetos'))
const AdminProjetoDetail = lazy(() => import('@/pages/admin/ProjetoDetail'))
const AdminRRTs = lazy(() => import('@/pages/admin/RRTs'))
const AdminRRTDetail = lazy(() => import('@/pages/admin/RRTDetail'))
const AdminChamados = lazy(() => import('@/pages/admin/Chamados'))
const AdminKanban = lazy(() => import('@/pages/admin/Kanban'))
const AdminCalendario = lazy(() => import('@/pages/admin/Calendario'))
const AdminPublicLib = lazy(() => import('@/pages/admin/PublicLib'))
const AdminAuditLog = lazy(() => import('@/pages/admin/AuditLog'))
const AdminConfig = lazy(() => import('@/pages/admin/Config'))

const ClienteDashboard = lazy(() => import('@/pages/cliente/Dashboard'))
const ClienteProjetos = lazy(() => import('@/pages/cliente/Projetos'))
const ClienteRRTs = lazy(() => import('@/pages/cliente/RRTs'))
const ClienteChamados = lazy(() => import('@/pages/cliente/Chamados'))
const ClienteNovoChamado = lazy(() => import('@/pages/cliente/NovoChamado'))
const ClienteCalendario = lazy(() => import('@/pages/cliente/Calendario'))
const ClienteEntityDetail = lazy(() => import('@/pages/cliente/EntityDetail'))

const ChamadoDetail = lazy(() => import('@/pages/ChamadoDetail'))
const PublicLibPage = lazy(() => import('@/pages/PublicLib'))

const AdminFinanceiro = lazy(() => import('@/pages/admin/Financeiro'))
const AdminRelatorios = lazy(() => import('@/pages/admin/Relatorios'))
const ClienteTime = lazy(() => import('@/pages/cliente/Time'))
const ClienteRelatorios = lazy(() => import('@/pages/cliente/Relatorios'))

function PageFallback() {
  return (
    <div className="grid min-h-[40vh] place-items-center text-sm text-muted">carregando…</div>
  )
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },

  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <S><Login /></S> },
      { path: '/auth/accept-invite', element: <S><AcceptInvite /></S> },
    ],
  },

  {
    element: <ProtectedRoute allow={['admin']} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin', element: <S><AdminDashboard /></S> },
          { path: '/admin/clientes', element: <S><AdminClientes /></S> },
          { path: '/admin/clientes/:id', element: <S><AdminClienteDetail /></S> },
          { path: '/admin/projetos', element: <S><AdminProjetos /></S> },
          { path: '/admin/projetos/:id', element: <S><AdminProjetoDetail /></S> },
          { path: '/admin/rrts', element: <S><AdminRRTs /></S> },
          { path: '/admin/rrts/:id', element: <S><AdminRRTDetail /></S> },
          { path: '/admin/chamados', element: <S><AdminChamados /></S> },
          { path: '/admin/chamados/:id', element: <S><ChamadoDetail isAdminView /></S> },
          { path: '/admin/kanban', element: <S><AdminKanban /></S> },
          { path: '/admin/calendario', element: <S><AdminCalendario /></S> },
          { path: '/admin/public-lib', element: <S><AdminPublicLib /></S> },
          { path: '/admin/financeiro', element: <S><AdminFinanceiro /></S> },
          { path: '/admin/relatorios', element: <S><AdminRelatorios /></S> },
          { path: '/admin/audit', element: <S><AdminAuditLog /></S> },
          { path: '/admin/config', element: <S><AdminConfig /></S> },
        ],
      },
    ],
  },

  {
    element: <ProtectedRoute allow={['company_owner', 'company_member']} />,
    children: [
      {
        element: <ClienteLayout />,
        children: [
          { path: '/c', element: <S><ClienteDashboard /></S> },
          { path: '/c/projetos', element: <S><ClienteProjetos /></S> },
          { path: '/c/projetos/:id', element: <S><ClienteEntityDetail /></S> },
          { path: '/c/rrts', element: <S><ClienteRRTs /></S> },
          { path: '/c/rrts/:id', element: <S><ClienteEntityDetail /></S> },
          { path: '/c/chamados', element: <S><ClienteChamados /></S> },
          { path: '/c/chamados/novo', element: <S><ClienteNovoChamado /></S> },
          { path: '/c/chamados/:id', element: <S><ChamadoDetail isAdminView={false} /></S> },
          { path: '/c/calendario', element: <S><ClienteCalendario /></S> },
          { path: '/c/time', element: <S><ClienteTime /></S> },
          { path: '/c/biblioteca', element: <S><PublicLibPage /></S> },
          { path: '/c/relatorios', element: <S><ClienteRelatorios /></S> },
        ],
      },
    ],
  },

  { path: '/public-lib', element: <S><PublicLibPage /></S> },

  { path: '*', element: <NotFound /> },
])
