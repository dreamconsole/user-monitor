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
import Teams from '@/pages/Teams';
import Settings from '@/pages/Settings';
import BreakGroups from '@/pages/BreakGroups';
import Breaks from '@/pages/Breaks';
import Reports from '@/pages/Reports';
import AppUsageDashboard from '@/pages/AppUsageDashboard';
import AppCategories from '@/pages/AppCategories';
import AppMapping from '@/pages/AppMapping';
import Timeline from '@/pages/Timeline';
import Profile from '@/pages/Profile';
import TeamComparison from '@/pages/TeamComparison';
import ActivityLogs from '@/pages/ActivityLogs';
import SuperAdminOverview from '@/pages/SuperAdminOverview';
import SuperAdminOrgs from '@/pages/SuperAdminOrgs';
import SuperAdminSettings from '@/pages/SuperAdminSettings';
import Layout from './components/layout/Layout';
import SuperAdminLayout from './components/layout/SuperAdminLayout';

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

          {/* Protected Routes - Standard User/Manager/Admin Layout */}
          <Route element={<ProtectedRoute />}>

            {/* SUPERADMIN SPECIFIC ROUTING (NO STANDARD LAYOUT) */}
            <Route element={<RoleGuard allowedRoles={['superadmin']} />}>
              <Route element={<SuperAdminLayout><Outlet /></SuperAdminLayout>}>
                <Route path="/superadmin" element={<SuperAdminOverview />} />
                <Route path="/superadmin/orgs" element={<SuperAdminOrgs />} />
                <Route path="/superadmin/settings" element={<SuperAdminSettings />} />
              </Route>
            </Route>

            {/* STANDARD LAYOUT - Non-SuperAdmin */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />

              {/* Admin & Manager Only */}
              <Route element={<RoleGuard allowedRoles={['orgadmin', 'manager']} />}>
                <Route path="/users" element={<Users />} />
                <Route path="/team-comparison" element={<TeamComparison />} />
                <Route path="/activity-logs" element={<ActivityLogs />} />
              </Route>

              <Route path="/reports" element={<Reports />} />

              {/* App Usage Analytics Sub-menus */}
              <Route path="/app-usage" element={<AppUsageDashboard />} />

              {/* App Categories & Mapping: Admin only */}
              <Route element={<RoleGuard allowedRoles={['orgadmin']} />}>
                <Route path="/app-categories" element={<AppCategories />} />
                <Route path="/app-mapping" element={<AppMapping />} />
              </Route>

              <Route path="/app-management" element={<Navigate to="/app-usage" replace />} />

              {/* Admin Only */}
              <Route element={<RoleGuard allowedRoles={['orgadmin']} />}>
                <Route path="/teams" element={<Teams />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/break-groups" element={<BreakGroups />} />
                <Route path="/breaks" element={<Breaks />} />
              </Route>

              {/* All authenticated users */}
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
