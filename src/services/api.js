
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// إنشاء نسخة من axios
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// إضافة التوكن تلقائياً للطلبات
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// معالجة الأخطاء
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// خدمات المصادقة
export const authService = {
    register: (userData) => api.post('/auth/register', userData),
    login: (credentials) => api.post('/auth/login', credentials),
    logout: () => api.post('/auth/logout'),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (token, password) => api.put(`/auth/reset-password/${token}`, { password }),
    verifyToken: () => api.get('/auth/verify')
};

// خدمات المستخدم
export const userService = {
    getProfile: () => api.get('/users/profile'),
    updateProfile: (userData) => api.put('/users/profile', userData),
    deleteAccount: () => api.delete('/users/profile'),
    restoreAccount: (credentials) => api.put('/users/restore', credentials),
    searchUsers: (query, page = 1, limit = 10) => 
        api.get(`/users/search?query=${query}&page=${page}&limit=${limit}`),
    getUserById: (id) => api.get(`/users/${id}`)
};

export default api;
