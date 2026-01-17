'use client';

import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

/**
 * 网络状态检测 Hook
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  });

  const updateNetworkInfo = useCallback(() => {
    const nav = navigator as Navigator & {
      connection?: {
        effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      };
    };

    setStatus({
      isOnline: navigator.onLine,
      isOffline: !navigator.onLine,
      effectiveType: nav.connection?.effectiveType,
      downlink: nav.connection?.downlink,
      rtt: nav.connection?.rtt,
      saveData: nav.connection?.saveData,
    });
  }, []);

  useEffect(() => {
    updateNetworkInfo();

    const handleOnline = () => updateNetworkInfo();
    const handleOffline = () => updateNetworkInfo();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 监听网络质量变化
    const nav = navigator as Navigator & {
      connection?: EventTarget;
    };
    nav.connection?.addEventListener('change', updateNetworkInfo);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      nav.connection?.removeEventListener('change', updateNetworkInfo);
    };
  }, [updateNetworkInfo]);

  return status;
}

/**
 * 离线提示组件用的 Hook
 */
export function useOfflineNotification() {
  const { isOffline } = useNetworkStatus();
  const [showNotification, setShowNotification] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setShowNotification(true);
      setWasOffline(true);
    } else if (wasOffline) {
      // 恢复在线，短暂显示恢复提示
      setTimeout(() => {
        setShowNotification(false);
        setWasOffline(false);
      }, 2000);
    }
  }, [isOffline, wasOffline]);

  return {
    isOffline,
    showNotification,
    dismiss: () => setShowNotification(false),
  };
}
