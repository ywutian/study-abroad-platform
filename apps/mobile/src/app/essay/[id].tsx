import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import EssayEditorScreen from '@/screens/essays/EssayEditorScreen';

export default function EssayEditorPage() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen
        options={{ title: id === 'new' ? t('essayEditor.newEssay') : t('essayEditor.editEssay') }}
      />
      <EssayEditorScreen />
    </>
  );
}
