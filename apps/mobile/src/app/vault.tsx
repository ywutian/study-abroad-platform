import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { VaultScreen } from '@/screens';

export default function VaultPage() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('vault.title') }} />
      <VaultScreen />
    </>
  );
}
