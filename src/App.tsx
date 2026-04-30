import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { ToastContainer } from './components/ui/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <ToastContainer />
    </ErrorBoundary>
  )
}
