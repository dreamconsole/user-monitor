import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '@/lib/useAuthStore';

/**
 * When subscription expired: orgadmin may only access /payment.
 * Must render <Outlet /> — this component is a React Router layout route.
 */
export default function SubscriptionBillingGate() {
    const { user } = useAuthStore();
    const location = useLocation();

    if (user?.role === 'orgadmin' && user?.billing?.billing_locked === true) {
        if (location.pathname !== '/payment') {
            return <Navigate to="/payment" replace state={{ from: location.pathname }} />;
        }
    }

    return <Outlet />;
}
