/**
 * 设置页面
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Constants from 'expo-constants';

import {
  AnimatedCard,
  CardContent,
  Switch,
  Avatar,
  Badge,
  AnimatedButton,
} from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { useAuthStore } from '@/stores';
import { useThemeStore } from '@/stores/theme';

interface SettingItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  type: 'navigate' | 'toggle' | 'action' | 'info';
  onPress?: () => void;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  danger?: boolean;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { colorScheme, setColorScheme } = useThemeStore();

  const [notifications, setNotifications] = useState(true);
  const [biometrics, setBiometrics] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      t('common.logout'),
      t('settings.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.logout'),
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccount'),
      t('settings.deleteAccountConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            // TODO: Call delete account API
            Alert.alert(t('settings.featureInDev'), t('settings.contactSupport'));
          },
        },
      ]
    );
  };

  const handleLanguageChange = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
    Haptics.selectionAsync();
  };

  const sections: SettingSection[] = [
    {
      title: t('settings.sections.account'),
      items: [
        {
          icon: 'person-outline',
          label: t('settings.personalInfo'),
          type: 'navigate',
          onPress: () => router.push('/profile/edit'),
        },
        {
          icon: 'shield-checkmark-outline',
          label: t('settings.accountSecurity'),
          type: 'navigate',
          onPress: () => router.push('/settings/security'),
        },
        {
          icon: 'card-outline',
          label: t('settings.subscription'),
          value: user?.role === 'VIP' ? 'VIP' : t('settings.freeVersion'),
          type: 'navigate',
          onPress: () => router.push('/settings/subscription'),
        },
      ],
    },
    {
      title: t('settings.sections.preferences'),
      items: [
        {
          icon: 'moon-outline',
          label: t('settings.darkMode'),
          type: 'toggle',
          toggleValue: colorScheme === 'dark',
          onToggle: (value) => {
            setColorScheme(value ? 'dark' : 'light');
            Haptics.selectionAsync();
          },
        },
        {
          icon: 'language-outline',
          label: t('settings.language'),
          value: i18n.language === 'zh' ? '简体中文' : 'English',
          type: 'navigate',
          onPress: handleLanguageChange,
        },
        {
          icon: 'notifications-outline',
          label: t('settings.pushNotification'),
          type: 'toggle',
          toggleValue: notifications,
          onToggle: (value) => {
            setNotifications(value);
            Haptics.selectionAsync();
          },
        },
        {
          icon: 'finger-print-outline',
          label: t('settings.biometrics'),
          type: 'toggle',
          toggleValue: biometrics,
          onToggle: (value) => {
            setBiometrics(value);
            Haptics.selectionAsync();
          },
        },
      ],
    },
    {
      title: t('settings.sections.support'),
      items: [
        {
          icon: 'help-circle-outline',
          label: t('settings.helpCenter'),
          type: 'navigate',
          onPress: () => Linking.openURL('https://help.example.com'),
        },
        {
          icon: 'chatbubble-outline',
          label: t('settings.contactSupport'),
          type: 'navigate',
          onPress: () => Linking.openURL('mailto:support@example.com'),
        },
        {
          icon: 'star-outline',
          label: t('settings.rateApp'),
          type: 'navigate',
          onPress: () => {
            // TODO: Open app store review
            Alert.alert(t('settings.thankYou'), t('settings.thankYouReview'));
          },
        },
      ],
    },
    {
      title: t('settings.sections.about'),
      items: [
        {
          icon: 'information-circle-outline',
          label: t('settings.version'),
          value: Constants.expoConfig?.version || '1.0.0',
          type: 'info',
        },
        {
          icon: 'document-text-outline',
          label: t('settings.termsOfService'),
          type: 'navigate',
          onPress: () => Linking.openURL('https://example.com/terms'),
        },
        {
          icon: 'shield-outline',
          label: t('settings.privacyPolicy'),
          type: 'navigate',
          onPress: () => Linking.openURL('https://example.com/privacy'),
        },
      ],
    },
  ];

  // 添加登出和删除账号
  if (isAuthenticated) {
    sections.push({
      title: t('settings.sections.accountActions'),
      items: [
        {
          icon: 'log-out-outline',
          label: t('common.logout'),
          type: 'action',
          onPress: handleLogout,
        },
        {
          icon: 'trash-outline',
          label: t('settings.deleteAccount'),
          type: 'action',
          danger: true,
          onPress: handleDeleteAccount,
        },
      ],
    });
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      {/* User Profile Card */}
      {isAuthenticated && user && (
        <Animated.View entering={FadeInDown.duration(400)}>
          <TouchableOpacity
            onPress={() => router.push('/profile/edit')}
            activeOpacity={0.7}
          >
            <AnimatedCard style={styles.profileCard}>
              <CardContent style={styles.profileContent}>
                <Avatar
                  source={user.avatar}
                  name={user.email}
                  size="lg"
                />
                <View style={styles.profileInfo}>
                  <Text style={[styles.profileName, { color: colors.foreground }]}>
                    {user.email.split('@')[0]}
                  </Text>
                  <Text style={[styles.profileEmail, { color: colors.foregroundMuted }]}>
                    {user.email}
                  </Text>
                  {user.role === 'VIP' && (
                    <Badge variant="warning" style={styles.vipBadge}>
                      <Ionicons name="diamond" size={12} color="#fff" />
                      <Text style={styles.vipText}> VIP</Text>
                    </Badge>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.foregroundMuted} />
              </CardContent>
            </AnimatedCard>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Settings Sections */}
      {sections.map((section, sectionIndex) => (
        <Animated.View
          key={section.title}
          entering={FadeInDown.delay(100 + sectionIndex * 50).duration(400)}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: colors.foregroundMuted }]}>
            {section.title}
          </Text>
          <AnimatedCard>
            <CardContent style={styles.sectionContent}>
              {section.items.map((item, itemIndex) => (
                <React.Fragment key={item.label}>
                  {itemIndex > 0 && (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                  <SettingRow
                    item={item}
                    colors={colors}
                  />
                </React.Fragment>
              ))}
            </CardContent>
          </AnimatedCard>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

// Setting Row Component
function SettingRow({ item, colors }: { item: SettingItem; colors: any }) {
  const textColor = item.danger ? colors.error : colors.foreground;

  const content = (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: item.danger ? colors.error + '15' : colors.muted }]}>
        <Ionicons name={item.icon} size={20} color={item.danger ? colors.error : colors.primary} />
      </View>
      <Text style={[styles.settingLabel, { color: textColor }]}>{item.label}</Text>
      
      {item.type === 'toggle' ? (
        <Switch
          value={item.toggleValue || false}
          onValueChange={item.onToggle}
        />
      ) : item.type === 'info' ? (
        <Text style={[styles.settingValue, { color: colors.foregroundMuted }]}>
          {item.value}
        </Text>
      ) : (
        <View style={styles.settingRight}>
          {item.value && (
            <Text style={[styles.settingValue, { color: colors.foregroundMuted }]}>
              {item.value}
            </Text>
          )}
          {item.type === 'navigate' && (
            <Ionicons name="chevron-forward" size={18} color={colors.foregroundMuted} />
          )}
        </View>
      )}
    </View>
  );

  if (item.type === 'toggle' || item.type === 'info') {
    return content;
  }

  return (
    <TouchableOpacity
      onPress={item.onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    margin: spacing.lg,
    marginBottom: 0,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  vipBadge: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  vipText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  section: {
    padding: spacing.lg,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  sectionContent: {
    padding: 0,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingLabel: {
    flex: 1,
    fontSize: fontSize.base,
  },
  settingValue: {
    fontSize: fontSize.sm,
    marginRight: spacing.xs,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60,
  },
});


