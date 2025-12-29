import axios from 'axios';

// اكتشاف عنوان الباك أند تلقائياً
const getBackendUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
  }
  return process.env.REACT_APP_BACKEND_URL || window.location.origin.replace(/:\d+/, ':5000');
};

const API_URL = getBackendUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// إضافة التوكن تلقائياً
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// معالجة الأخطاء العالمية
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

// التحقق من اتصال الباك أند
export const checkBackendHealth = async () => {
  try {
    const response = await axios.get(`${API_URL}/`);
    return {
      connected: true,
      message: response.data.message,
      url: API_URL
    };
  } catch (error) {
    return {
      connected: false,
      message: error.message,
      url: API_URL
    };
  }
};

// خدمات المستخدمين والمصادقة
export const authService = {
  register: (userData) => api.post('/api/auth/register', userData),
  login: (credentials) => api.post('/api/auth/login', credentials),
  logout: () => api.post('/api/auth/logout'),
  verifyToken: () => api.get('/api/auth/verify'),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.put(`/api/auth/reset-password/${token}`, { password }),
};

export const userService = {
  getProfile: () => api.get('/api/users/profile'),
  updateProfile: (userData) => api.put('/api/users/profile', userData),
  deleteAccount: () => api.delete('/api/users/profile'),
  restoreAccount: (credentials) => api.put('/api/users/restore', credentials),
  searchUsers: (query, page = 1, limit = 20) => 
    api.get(`/api/users/search`, { params: { query, page, limit } }),
  getUserById: (id) => api.get(`/api/users/${id}`),
};

// خدمات النظام
export const systemService = {
  getHealth: () => api.get('/api/health'),
  getFrontendHealth: () => axios.get('http://localhost:3000/api/frontend/health'),
};

export default api;
