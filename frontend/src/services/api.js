import axios from 'axios';

import { API_BASE_URL } from '../constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getUsers: () => api.get('/auth/users'),
  updateUser: (userId, userData) => api.put(`/auth/users/${userId}`, userData),
  verifyManagerPin: (pin) => api.post('/auth/verify-manager-pin', { pin })
};

export const syncApi = {
  sync: (data) => api.post('/sync', data),
};

export default api;
