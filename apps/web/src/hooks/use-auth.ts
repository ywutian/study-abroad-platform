'use client';

import { useAuthStore } from '@/stores/auth';

export function useAuth() {
  const {
    user,
    accessToken,
    isLoading,
    setUser,
    setTokens,
    setLoading,
    logout,
    refreshAccessToken,
  } = useAuthStore();

  const isAuthenticated = !!accessToken && !!user;
  const isAdmin = user?.role === 'ADMIN';
  const isVerified = user?.role === 'VERIFIED' || user?.role === 'ADMIN';

  return {
    user,
    accessToken,
    isLoading,
    isAuthenticated,
    isAdmin,
    isVerified,
    setUser,
    setTokens,
    setLoading,
    logout,
    refreshAccessToken,
  };
}

