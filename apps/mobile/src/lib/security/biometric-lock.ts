import type { AppStateStatus } from 'react-native';

export function shouldActivateBiometricLock(
  appState: AppStateStatus,
  isAuthenticated: boolean,
  storedPreference: string | null
): boolean {
  return (
    isAuthenticated &&
    storedPreference === 'true' &&
    (appState === 'inactive' || appState === 'background')
  );
}
