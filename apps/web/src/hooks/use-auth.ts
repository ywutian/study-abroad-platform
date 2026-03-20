'use client';

import { useAuthStore, setAuthFromLogin } from '@/stores/auth';

/**
 * 认证 Hook
 *
 * 提供认证状态和操作方法
 *
 * 安全说明：
 * - accessToken 仅存在于内存中，不持久化
 * - 使用 setAuthFromLogin 设置认证状态（用于登录成功后）
 * - refreshToken 通过 httpOnly cookie 管理，JavaScript 无法访问
 */
export function useAuth() {
  const {
    user,
    accessToken,
    isLoading,
    isInitialized,
    setUser,
    setAccessToken,
    setLoading,
    logout,
    refreshAccessToken,
    initialize,
  } = useAuthStore();

  const isAuthenticated = !!accessToken && !!user;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isOperator = isAdmin || user?.role === 'OPERATOR';
  const isVerified = isOperator || user?.role === 'VERIFIED';

  return {
    user,
    accessToken,
    isLoading,
    isInitialized,
    isAuthenticated,
    isAdmin,
    isOperator,
    isVerified,
    setUser,
    setAccessToken,
    setLoading,
    logout,
    refreshAccessToken,
    initialize,
    // 用于登录成功后设置认证状态
    setAuthFromLogin,
  };
}
