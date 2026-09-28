import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './components/AppLayout.tsx'
import { ProtectedRoute, GuestOnlyRoute } from './auth/ProtectedRoute.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { ProjectsPage } from './pages/ProjectsPage.tsx'
import { ProjectDetailPage } from './pages/ProjectDetailPage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'
import { ServerUnavailablePage } from './pages/ServerUnavailablePage.tsx'
import { useAuth } from './auth/useAuth.ts'

function App() {
  const { status, retryAuthentication } = useAuth()

  if (status === 'unavailable') {
    return <ServerUnavailablePage onRetry={retryAuthentication} />
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route
        path="/login"
        element={
          <GuestOnlyRoute>
            <LoginPage />
          </GuestOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnlyRoute>
            <RegisterPage />
          </GuestOnlyRoute>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProjectDetailPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProjectsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <NotFoundPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
