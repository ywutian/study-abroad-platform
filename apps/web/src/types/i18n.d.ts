/**
 * next-intl 类型配置
 *
 * 当前使用宽松模式，允许动态拼接翻译 key，
 * 如 t(`prefix.${variable}.suffix`)。
 *
 * 严格模式（基于 zh.json 推断 key 类型）会在 130+ 处动态 key
 * 使用时报 TS2345。待所有动态 key 迁移为类型安全写法后可重新启用。
 *
 * 注意：文件中必须保留至少一个 import/export，否则 declare module
 * 会变成 ambient declaration 而非 module augmentation，导致
 * useTranslations 等 API 的类型丢失。
 *
 * @see https://next-intl.dev/docs/workflows/typescript
 */

// 保留 import 使本文件成为 module (而非 ambient declaration)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { useTranslations } from 'next-intl';

 
type LooseMessages = Record<string, any>;

declare module 'next-intl' {
  interface AppConfig {
    Messages: LooseMessages;
  }
}
