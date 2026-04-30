import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-linen px-4 py-8">
      <Outlet />
    </main>
  )
}
