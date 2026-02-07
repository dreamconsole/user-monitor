import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../lib/useAuthStore';

const ProtectedRoute = () => {
    const { isAuthenticated, loading } = useAuthStore();

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
