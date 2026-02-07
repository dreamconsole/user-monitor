import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../lib/useAuthStore';

const RoleGuard = ({ allowedRoles }) => {
    const { user, isAuthenticated, loading } = useAuthStore();

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    const hasAccess = allowedRoles.includes(user.role);

    return hasAccess ? <Outlet /> : <Navigate to="/" replace />;
};

export default RoleGuard;
