import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PointsScreen } from '@/screens';

export default function PointsPage() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('points.title') }} />
      <PointsScreen />
    </>
  );
}
