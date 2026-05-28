import axios from 'axios';
import { toast } from 'sonner';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    timeout: 30000,
});

// Request interceptor - attach token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor - handle errors globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            const { status, data } = error.response;

            if (status === 401) {
                // Auto-logout on unauthorized
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                if (window.location.pathname !== '/login') {
                    toast.error('Session expired. Please log in again.');
                    window.location.href = '/login';
                }
            } else if (status === 403 && data?.billing_locked && window.location.pathname !== '/payment') {
                toast.error(data?.error || 'Subscription expired. Complete payment to continue.');
                window.location.href = '/payment';
            } else if (status === 429) {
                toast.error('Too many requests. Please slow down.');
            } else if (status >= 500) {
                toast.error(data?.error || 'Server error. Please try again later.');
            }
        } else if (error.code === 'ECONNABORTED') {
            toast.error('Request timed out. Please try again.');
        } else if (!error.response) {
            toast.error('Network error. Please check your connection.');
        }
        return Promise.reject(error);
    }
);

export default api;
