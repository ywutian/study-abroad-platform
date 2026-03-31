import { authRoutes } from '@study-abroad/shared';
import { apiClient } from '../client';

export const authService = {
  login: (dto: { email: string; password: string }) =>
    apiClient.post(authRoutes.login(), dto, { skipAuth: true }),
  register: (dto: { email: string; password: string; name: string }) =>
    apiClient.post(authRoutes.register(), dto, { skipAuth: true }),
  logout: (refreshToken: string) => apiClient.post(authRoutes.logout(), { refreshToken }),
  refreshToken: (refreshToken: string) =>
    apiClient.post(authRoutes.refresh(), { refreshToken }, { skipAuth: true }),
  verifyEmail: (token: string) =>
    apiClient.post(authRoutes.verifyEmail(), { token }, { skipAuth: true }),
  forgotPassword: (email: string) =>
    apiClient.post(authRoutes.forgotPassword(), { email }, { skipAuth: true }),
  resetPassword: (token: string, newPassword: string) =>
    apiClient.post(authRoutes.resetPassword(), { token, newPassword }, { skipAuth: true }),
};
