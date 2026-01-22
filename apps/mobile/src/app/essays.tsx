import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EssaysScreen } from '@/screens';

export default function EssaysPage() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('essays.title') }} />
      <EssaysScreen />
    </>
  );
}
