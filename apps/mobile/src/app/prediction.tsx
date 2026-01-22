import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PredictionScreen } from '@/screens';

export default function PredictionPage() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('prediction.title') }} />
      <PredictionScreen />
    </>
  );
}
