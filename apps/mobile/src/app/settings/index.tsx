import { Stack, router } from 'expo-router';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SettingsScreen } from '@/screens';
import { useColors } from '@/utils/theme';

/**
 * /settings is the root screen of the settings nested stack, so it has no
 * automatic back button. Provide an explicit one so users aren't stranded.
 */
export default function SettingsPage() {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.back}
            >
              <Ionicons name="chevron-back" size={26} color={colors.foreground} />
            </TouchableOpacity>
          ),
        }}
      />
      <SettingsScreen />
    </>
  );
}

const styles = StyleSheet.create({
  back: { paddingRight: 8 },
});
