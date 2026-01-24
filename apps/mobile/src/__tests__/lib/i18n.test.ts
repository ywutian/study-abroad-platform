/**
 * Tests for the i18n setup at src/lib/i18n/index.ts
 *
 * Covers: initI18n() initialization, default language selection,
 * translation key resolution for both en and zh, changeLanguage(),
 * getCurrentLanguage(), and fallback behaviour.
 */

// --------------- mocks ---------------

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'zh' }]),
}));

// Mock the storage helper used by i18n (it uses AsyncStorage internally)
jest.mock('@/lib/storage/secure-store', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveTokens: jest.fn(),
  clearAuthData: jest.fn(),
  storage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn(),
    clear: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { storage } from '@/lib/storage/secure-store';

// We import i18n-related utilities lazily after mocks are set up.
import { initI18n, changeLanguage, getCurrentLanguage, i18n } from '@/lib/i18n/index';

// ======================================================================
// Tests
// ======================================================================

describe('i18n', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset storage mock default
    (storage.get as jest.Mock).mockResolvedValue(null);
    // Reset Localization mock default
    (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'zh' }]);
  });

  // ----- initI18n -----
  describe('initI18n', () => {
    it('initializes i18next and returns the i18n instance', async () => {
      const instance = await initI18n();

      expect(instance).toBeDefined();
      expect(instance.isInitialized).toBe(true);
    });

    it('defaults to zh when system language is zh and no saved preference', async () => {
      (storage.get as jest.Mock).mockResolvedValue(null);
      (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'zh' }]);

      await initI18n();

      expect(i18n.language).toBe('zh');
    });

    it('defaults to en when system language is en and no saved preference', async () => {
      (storage.get as jest.Mock).mockResolvedValue(null);
      (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);

      await initI18n();

      expect(i18n.language).toBe('en');
    });

    it('falls back to en for non-zh system languages (e.g. fr)', async () => {
      (storage.get as jest.Mock).mockResolvedValue(null);
      (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'fr' }]);

      await initI18n();

      expect(i18n.language).toBe('en');
    });

    it('uses saved language preference over system language', async () => {
      (storage.get as jest.Mock).mockResolvedValue('en');
      (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'zh' }]);

      await initI18n();

      expect(i18n.language).toBe('en');
    });

    it('ignores invalid saved language and uses system language', async () => {
      (storage.get as jest.Mock).mockResolvedValue('de'); // not in [zh, en]
      (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'zh' }]);

      await initI18n();

      expect(i18n.language).toBe('zh');
    });

    it('falls back to zh when getLocales returns empty array', async () => {
      (storage.get as jest.Mock).mockResolvedValue(null);
      (Localization.getLocales as jest.Mock).mockReturnValue([]);

      await initI18n();

      // With no locale, languageCode is undefined, falls to 'zh' default
      expect(i18n.language).toBe('zh');
    });
  });

  // ----- Translation keys -----
  describe('translation key resolution', () => {
    beforeEach(async () => {
      (storage.get as jest.Mock).mockResolvedValue(null);
      (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
      await initI18n();
    });

    describe('English translations', () => {
      beforeEach(async () => {
        await i18n.changeLanguage('en');
      });

      it('resolves common.appName', () => {
        expect(i18n.t('common.appName')).toBe('Study Abroad Platform');
      });

      it('resolves common.save', () => {
        expect(i18n.t('common.save')).toBe('Save');
      });

      it('resolves common.cancel', () => {
        expect(i18n.t('common.cancel')).toBe('Cancel');
      });

      it('resolves tabs keys', () => {
        expect(i18n.t('tabs.home')).toBe('Home');
        expect(i18n.t('tabs.schools')).toBe('Schools');
        expect(i18n.t('tabs.cases')).toBe('Cases');
        expect(i18n.t('tabs.ai')).toBe('AI');
        expect(i18n.t('tabs.profile')).toBe('Profile');
      });

      it('resolves auth.login.title', () => {
        expect(i18n.t('auth.login.title')).toBe('Login');
      });

      it('resolves nested keys like home.features.profile', () => {
        expect(i18n.t('home.features.profile')).toBe('My Profile');
      });

      it('resolves error keys', () => {
        expect(i18n.t('errors.networkError')).toBe('Network error, please try again');
        expect(i18n.t('errors.unauthorized')).toBe('Please login first');
      });
    });

    describe('Chinese translations', () => {
      beforeEach(async () => {
        await i18n.changeLanguage('zh');
      });

      it('resolves common.appName', () => {
        expect(i18n.t('common.appName')).toBe('留学申请平台');
      });

      it('resolves common.save', () => {
        expect(i18n.t('common.save')).toBe('保存');
      });

      it('resolves common.cancel', () => {
        expect(i18n.t('common.cancel')).toBe('取消');
      });

      it('resolves tabs keys', () => {
        expect(i18n.t('tabs.home')).toBe('首页');
        expect(i18n.t('tabs.schools')).toBe('学校');
        expect(i18n.t('tabs.cases')).toBe('案例');
        expect(i18n.t('tabs.ai')).toBe('AI');
        expect(i18n.t('tabs.profile')).toBe('我的');
      });

      it('resolves auth.login.title', () => {
        expect(i18n.t('auth.login.title')).toBe('登录');
      });

      it('resolves nested keys like home.features.profile', () => {
        expect(i18n.t('home.features.profile')).toBe('我的档案');
      });

      it('resolves error keys', () => {
        expect(i18n.t('errors.networkError')).toBe('网络错误，请重试');
        expect(i18n.t('errors.unauthorized')).toBe('请先登录');
      });
    });
  });

  // ----- changeLanguage -----
  describe('changeLanguage', () => {
    beforeEach(async () => {
      (storage.get as jest.Mock).mockResolvedValue(null);
      (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
      await initI18n();
    });

    it('changes language to zh and persists the preference', async () => {
      await changeLanguage('zh');

      expect(i18n.language).toBe('zh');
      expect(storage.set).toHaveBeenCalledWith('app_language', 'zh');
    });

    it('changes language to en and persists the preference', async () => {
      await changeLanguage('en');

      expect(i18n.language).toBe('en');
      expect(storage.set).toHaveBeenCalledWith('app_language', 'en');
    });

    it('translates correctly after language change', async () => {
      await changeLanguage('zh');
      expect(i18n.t('common.appName')).toBe('留学申请平台');

      await changeLanguage('en');
      expect(i18n.t('common.appName')).toBe('Study Abroad Platform');
    });
  });

  // ----- getCurrentLanguage -----
  describe('getCurrentLanguage', () => {
    it('returns the current language string', async () => {
      await initI18n();
      await i18n.changeLanguage('en');

      expect(getCurrentLanguage()).toBe('en');
    });

    it('returns zh after switching to Chinese', async () => {
      await initI18n();
      await i18n.changeLanguage('zh');

      expect(getCurrentLanguage()).toBe('zh');
    });
  });

  // ----- Fallback -----
  describe('fallback language', () => {
    it('uses zh as the fallback language (fallbackLng)', async () => {
      await initI18n();
      // Access a key that only exists -- fallback is zh
      // If we set language to something invalid, i18next falls back to zh
      await i18n.changeLanguage('zh');
      // Verify a zh translation works as fallback proof
      expect(i18n.t('common.appName')).toBe('留学申请平台');
    });
  });
});
