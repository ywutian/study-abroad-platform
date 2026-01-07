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
      '退出登录',
      '确定要退出登录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '退出',
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
      '删除账号',
      '此操作不可逆，确定要删除账号吗？所有数据将被永久删除。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            // TODO: Call delete account API
            Alert.alert('功能开发中', '请联系客服删除账号');
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
      title: '账户',
      items: [
        {
          icon: 'person-outline',
          label: '个人信息',
          type: 'navigate',
          onPress: () => router.push('/profile/edit'),
        },
        {
          icon: 'shield-checkmark-outline',
          label: '账号安全',
          type: 'navigate',
          onPress: () => router.push('/settings/security'),
        },
        {
          icon: 'card-outline',
          label: '会员订阅',
          value: user?.role === 'VIP' ? 'VIP' : '免费版',
          type: 'navigate',
          onPress: () => router.push('/settings/subscription'),
        },
      ],
    },
    {
      title: '偏好设置',
      items: [
        {
          icon: 'moon-outline',
          label: '深色模式',
          type: 'toggle',
          toggleValue: colorScheme === 'dark',
          onToggle: (value) => {
            setColorScheme(value ? 'dark' : 'light');
            Haptics.selectionAsync();
          },
        },
        {
          icon: 'language-outline',
          label: '语言',
          value: i18n.language === 'zh' ? '简体中文' : 'English',
          type: 'navigate',
          onPress: handleLanguageChange,
        },
        {
          icon: 'notifications-outline',
          label: '推送通知',
          type: 'toggle',
          toggleValue: notifications,
          onToggle: (value) => {
            setNotifications(value);
            Haptics.selectionAsync();
          },
        },
        {
          icon: 'finger-print-outline',
          label: '生物识别',
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
      title: '支持',
      items: [
        {
          icon: 'help-circle-outline',
          label: '帮助中心',
          type: 'navigate',
          onPress: () => Linking.openURL('https://help.example.com'),
        },
        {
          icon: 'chatbubble-outline',
          label: '联系客服',
          type: 'navigate',
          onPress: () => Linking.openURL('mailto:support@example.com'),
        },
        {
          icon: 'star-outline',
          label: '给我们评分',
          type: 'navigate',
          onPress: () => {
            // TODO: Open app store review
            Alert.alert('感谢支持', '感谢您的好评！');
          },
        },
      ],
    },
    {
      title: '关于',
      items: [
        {
          icon: 'information-circle-outline',
          label: '版本',
          value: Constants.expoConfig?.version || '1.0.0',
          type: 'info',
        },
        {
          icon: 'document-text-outline',
          label: '用户协议',
          type: 'navigate',
          onPress: () => Linking.openURL('https://example.com/terms'),
        },
        {
          icon: 'shield-outline',
          label: '隐私政策',
          type: 'navigate',
          onPress: () => Linking.openURL('https://example.com/privacy'),
        },
      ],
    },
  ];

  // 添加登出和删除账号
  if (isAuthenticated) {
    sections.push({
      title: '账号操作',
      items: [
        {
          icon: 'log-out-outline',
          label: '退出登录',
          type: 'action',
          onPress: handleLogout,
        },
        {
          icon: 'trash-outline',
          label: '删除账号',
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


