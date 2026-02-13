import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import useAuthStore from './lib/useAuthStore';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleGuard from './components/auth/RoleGuard';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Users from '@/pages/Users';
import Settings from '@/pages/Settings';
import Breaks from '@/pages/Breaks';
import Reports from '@/pages/Reports';
import AppCategories from '@/pages/AppCategories';
import AppMapping from '@/pages/AppMapping';
import AppUsageDashboard from '@/pages/AppUsageDashboard';
import Layout from './components/layout/Layout';

const AppLayout = () => (
  <Layout>
    <Outlet />
  </Layout>
);

function App() {
  const { restoreAuth, loading } = useAuthStore();

  useEffect(() => {
    restoreAuth();
  }, [restoreAuth]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />

            {/* Admin & Manager Only */}
            <Route element={<RoleGuard allowedRoles={['orgadmin', 'manager']} />}>
              <Route path="/users" element={<Users />} />
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

          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
