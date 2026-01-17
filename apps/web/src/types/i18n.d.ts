/**
 * next-intl 类型安全配置
 *
 * 基于 zh.json 生成翻译 key 的 TypeScript 类型，
 * 使 useTranslations() 和 t() 在编译期就能检测到错误的 key。
 *
 * 效果：
 * - useTranslations('profile') 中的 namespace 有自动补全
 * - t('nonExistentKey') 会产生 TypeScript 编译错误
 * - IDE 中输入 t(' 时显示所有可用 key
 *
 * @see https://next-intl.dev/docs/workflows/typescript
 */

import zh from '@/messages/zh.json';

type Messages = typeof zh;

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
