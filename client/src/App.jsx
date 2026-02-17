import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import useAuthStore from './lib/useAuthStore';
import useThemeStore from './lib/useThemeStore';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleGuard from './components/auth/RoleGuard';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from './components/ui/toaster';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Users from '@/pages/Users';
import Settings from '@/pages/Settings';
import Breaks from '@/pages/Breaks';
import Reports from '@/pages/Reports';
import AppCategories from '@/pages/AppCategories';
import AppMapping from '@/pages/AppMapping';
import AppUsageDashboard from '@/pages/AppUsageDashboard';
import Timeline from '@/pages/Timeline';
import Profile from '@/pages/Profile';
import TeamComparison from '@/pages/TeamComparison';
import Layout from './components/layout/Layout';

const AppLayout = () => (
  <Layout>
    <Outlet />
  </Layout>
);

function App() {
  const { restoreAuth, loading } = useAuthStore();
  const { initTheme } = useThemeStore();

  useEffect(() => {
    restoreAuth();
    initTheme();
  }, [restoreAuth, initTheme]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />

            {/* Admin & Manager Only */}
            <Route element={<RoleGuard allowedRoles={['orgadmin', 'manager']} />}>
              <Route path="/users" element={<Users />} />
              <Route path="/team-comparison" element={<TeamComparison />} />
            </Route>

              <Route path="/reports" element={<Reports />} />

              {/* Admin Only */}
              <Route element={<RoleGuard allowedRoles={['orgadmin']} />}>
                <Route path="/settings" element={<Settings />} />
                <Route path="/breaks" element={<Breaks />} />
                <Route path="/app-categories" element={<AppCategories />} />
                <Route path="/app-mapping" element={<AppMapping />} />
              </Route>

            {/* All authenticated users */}
            <Route path="/app-usage" element={<AppUsageDashboard />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/profile" element={<Profile />} />

            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
