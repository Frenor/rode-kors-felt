import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { LoginPage } from './pages/LoginPage';
import { CodeEntryPage } from './pages/CodeEntryPage';
import { FirstAiderDashboard } from './pages/FirstAiderDashboard';
import { IncidentForm } from './pages/IncidentForm';
import { SickBayDashboard } from './pages/SickBayDashboard';
import { CoordinatorDashboard } from './pages/CoordinatorDashboard';
import { AppShell } from './components/AppShell';
import './styles/global.css';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, role } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to correct dashboard based on role
    if (role === 'first_aider') return <Navigate to="/firstaid" replace />;
    if (role === 'sickbay') return <Navigate to="/sickbay" replace />;
    if (role === 'coordinator') return <Navigate to="/coordinator" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated, role } = useAuthStore();

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={
          isAuthenticated ? (
            <Navigate to={
              role === 'first_aider' ? '/firstaid' :
              role === 'sickbay' ? '/sickbay' :
              '/coordinator'
            } replace />
          ) : (
            <CodeEntryPage />
          )
        } />
        <Route path="/login" element={<LoginPage />} />

        {/* First Aider routes */}
        <Route path="/firstaid" element={
          <ProtectedRoute allowedRoles={['first_aider']}>
            <AppShell>
              <FirstAiderDashboard />
            </AppShell>
          </ProtectedRoute>
        } />
        <Route path="/firstaid/incident" element={
          <ProtectedRoute allowedRoles={['first_aider']}>
            <AppShell>
              <IncidentForm />
            </AppShell>
          </ProtectedRoute>
        } />

        {/* Sick Bay routes */}
        <Route path="/sickbay" element={
          <ProtectedRoute allowedRoles={['sickbay']}>
            <AppShell>
              <SickBayDashboard />
            </AppShell>
          </ProtectedRoute>
        } />

        {/* Coordinator routes */}
        <Route path="/coordinator" element={
          <ProtectedRoute allowedRoles={['coordinator']}>
            <AppShell>
              <CoordinatorDashboard />
            </AppShell>
          </ProtectedRoute>
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
