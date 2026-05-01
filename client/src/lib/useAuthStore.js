import { create } from 'zustand';
import api from './api';

const useAuthStore = create((set, get) => ({
    user: null,
    token: localStorage.getItem('token') || null,
    isAuthenticated: !!localStorage.getItem('token'),
    loading: true,

    login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', data.token);
        set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            loading: false,
        });
        return data;
    },

    getSSOStatus: async () => {
        const { data } = await api.get('/auth/sso/status');
        return data; // { google: true, microsoft: false, apple: false }
    },

    verifySSO: async (provider, credential) => {
        const { data } = await api.post('/auth/sso/verify', { provider, credential });
        localStorage.setItem('token', data.token);
        set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            loading: false,
        });
        return data;
    },

    registerOrg: async (registerData) => {
        const { data } = await api.post('/auth/register-org', registerData);
        localStorage.setItem('token', data.token);
        set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            loading: false,
        });
        return data;
    },

    logout: () => {
        localStorage.removeItem('token');
        set({
            user: null,
            token: null,
            isAuthenticated: false,
            loading: false,
        });
    },

    restoreAuth: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            set({ loading: false });
            return;
        }

        try {
            // In a real app, you might want to call /auth/me to verify the token
            // and get the latest user data. For now, we assume the token is valid
            // or will be validated by the first API call.
            const { data } = await api.get('/auth/me');
            set({
                user: data,
                token: token,
                isAuthenticated: true,
                loading: false,
            });
        } catch (error) {
            console.error('Failed to restore auth:', error);
            localStorage.removeItem('token');
            set({
                user: null,
                token: null,
                isAuthenticated: false,
                loading: false,
            });
        }
    },

    refreshUser: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const { data } = await api.get('/auth/me');
            set({ user: data, token });
        } catch (e) {
            console.error('refreshUser failed:', e);
        }
    },

    hasRole: (roles) => {
        const user = get().user;
        if (!user) return false;
        return roles.includes(user.role);
    },
}));

export default useAuthStore;
