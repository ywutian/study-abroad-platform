import { apiClient } from '../client';

export const authService = {
  login: (dto: { email: string; password: string }) =>
    apiClient.post('/auth/login', dto, { skipAuth: true }),
  register: (dto: { email: string; password: string; name: string }) =>
    apiClient.post('/auth/register', dto, { skipAuth: true }),
  logout: (refreshToken: string) => apiClient.post('/auth/logout', { refreshToken }),
  refreshToken: (refreshToken: string) =>
    apiClient.post('/auth/refresh', { refreshToken }, { skipAuth: true }),
  verifyEmail: (token: string) =>
    apiClient.post('/auth/verify-email', { token }, { skipAuth: true }),
  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }, { skipAuth: true }),
  resetPassword: (token: string, newPassword: string) =>
    apiClient.post('/auth/reset-password', { token, newPassword }, { skipAuth: true }),
};
