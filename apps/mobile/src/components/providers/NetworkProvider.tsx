/**
 * 网络状态 Provider
 *
 * 检测网络连接状态，显示离线提示
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { useColors, spacing, fontSize, fontWeight } from '@/utils/theme';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: true,
  connectionType: null,
});

export function useNetwork() {
  return useContext(NetworkContext);
}

interface NetworkProviderProps {
  children: React.ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [networkState, setNetworkState] = useState<NetworkContextType>({
    isConnected: true,
    isInternetReachable: true,
    connectionType: null,
  });

  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const bannerAnim = useState(new Animated.Value(-100))[0];

  const showOfflineBanner = useCallback(() => {
    setShowBanner(true);
    Animated.spring(bannerAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, [bannerAnim]);

  const hideOfflineBanner = useCallback(() => {
    Animated.timing(bannerAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowBanner(false));
  }, [bannerAnim]);

  useEffect(() => {
    // Sync React Query's online manager with the real network state so
    // queries automatically pause when offline and resume when back online.
    const unsubscribeOnline = NetInfo.addEventListener((s) => {
      onlineManager.setOnline(s.isConnected === true && s.isInternetReachable !== false);
    });

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected ?? false;
      const isInternetReachable = state.isInternetReachable;

      setNetworkState({
        isConnected,
        isInternetReachable,
        connectionType: state.type,
      });

      // 离线时显示 banner
      if (!isConnected || isInternetReachable === false) {
        setWasOffline(true);
        showOfflineBanner();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      // 恢复连接时显示短暂提示然后隐藏
      else if (wasOffline && isConnected) {
        // 显示"已恢复连接"2秒后隐藏
        setTimeout(() => {
          hideOfflineBanner();
          setWasOffline(false);
        }, 2000);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeOnline();
    };
  }, [wasOffline, showOfflineBanner, hideOfflineBanner]);

  const isOffline = !networkState.isConnected || networkState.isInternetReachable === false;

  return (
    <NetworkContext.Provider value={networkState}>
      {children}

      {/* Offline Banner */}
      {showBanner && (
        <Animated.View
          style={[
            styles.banner,
            {
              backgroundColor: isOffline ? colors.error : colors.success,
              paddingTop: insets.top + spacing.sm,
              transform: [{ translateY: bannerAnim }],
            },
          ]}
        >
          <View style={styles.bannerContent}>
            <Ionicons
              name={isOffline ? 'cloud-offline-outline' : 'cloud-done-outline'}
              size={20}
              color="#fff"
            />
            <Text style={styles.bannerText}>
              {isOffline ? t('ui.network.offline') : t('ui.network.restored')}
            </Text>
          </View>
        </Animated.View>
      )}
    </NetworkContext.Provider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.sm,
    zIndex: 9999,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  bannerText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
