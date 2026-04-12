import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { LoginPage } from '@/auth/LoginPage'
import { DashboardLayout } from '@/layout/DashboardLayout'
import { Dashboard } from '@/pages/Dashboard'
import { PatientListPage } from '@/pages/patients/PatientListPage'
import { PatientDetailPage } from '@/pages/patients/PatientDetailPage'
import { NewRecordingPage } from '@/pages/recordings/NewRecordingPage'
import { AuditLogsPage } from '@/pages/audit/AuditLogsPage'
import { BackupsPage } from '@/pages/backups/BackupsPage'
import { RiskThresholdsPage } from '@/pages/settings/RiskThresholdsPage'
import { UserManagementPage } from '@/pages/users/UserManagementPage'
import { ROLES } from '@/constants/roles'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route
                path="patients"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.MEDICO, ROLES.ADMIN]}>
                    <PatientListPage />
                  </ProtectedRoute>
                }
              />
              <Route path="patients/new" element={<Navigate to="/patients" replace />} />
              <Route
                path="patients/:id"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.MEDICO, ROLES.ADMIN]}>
                    <PatientDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="patients/:id/record"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.MEDICO, ROLES.ADMIN]}>
                    <NewRecordingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="recordings/new"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.MEDICO, ROLES.ADMIN]}>
                    <NewRecordingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings/thresholds"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                    <RiskThresholdsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="backups"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                    <BackupsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="audit"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.AUDITOR]}>
                    <AuditLogsPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
