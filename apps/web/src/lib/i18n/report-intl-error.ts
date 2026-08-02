import * as Sentry from '@sentry/nextjs';
import { IntlErrorCode, type IntlError } from 'next-intl';

/**
 * next-intl 的 onError 钩子，挂在 request.ts 上（服务端）。
 *
 * 客户端那半边没有：onError 是函数，没法从 Server Component 序列化给
 * NextIntlClientProvider；套一层 'use client' wrapper 转发会让 next-intl 的
 * 服务端变体失效（locale/formats/timeZone/now 的自动补全全丢），试过，回退了。
 *
 * 为什么需要它：目录里有 280+ 个 key 只能通过 t(`prefix.${x}`) 这类动态拼接命中，
 * 静态检查（check-unused-keys / check-missing-keys）看不见它们。缺 key 时
 * next-intl 默认只往 console 打一行，生产环境等于无声失败 —— 用户看到的是
 * 一串原始 key 路径。
 *
 * 收窄 NextIntlClientProvider 作用域（只发当前页要的 namespace）之前，先靠这个
 * 攒一批真实的 MISSING_MESSAGE 数据，别靠静态推断拍脑袋决定哪些 namespace 能砍。
 *
 * 其余错误码维持默认行为，不改语义。
 */

// 同一个 key 只上报一次：缺失的 key 常在列表里渲染上百次，不去重会瞬间打满配额。
// ponytail: 进程内 Set 就够用，key 总数天然有上限；跨实例聚合交给 Sentry 分组
const reported = new Set<string>();

/** 从 "Could not resolve `a.b.c` in messages for locale `zh`." 里取出 a.b.c */
function extractKey(error: IntlError): string {
  return error.originalMessage?.match(/`([^`]+)`/)?.[1] ?? error.message;
}

export function reportIntlError(error: IntlError): void {
  const isDev = process.env.NODE_ENV !== 'production';

  // 其余错误码（格式串写错、类型不符等）：这些是真 bug，生产也必须可见，
  // 只打 console 等于没上报 —— 走 Sentry 的 error 级别。
  if (error.code !== IntlErrorCode.MISSING_MESSAGE) {
    if (isDev) {
      console.warn(`[i18n] ${error.code}: ${error.message}`);
    } else {
      Sentry.captureException(error, { tags: { i18n_code: error.code } });
    }
    return;
  }

  const key = extractKey(error);
  if (reported.has(key)) return;
  reported.add(key);

  // 开发期直接吼出来，别等上了生产才发现
  if (isDev) {
    console.warn(`[i18n] 缺少翻译: ${key}`);
    return;
  }

  Sentry.captureMessage(`i18n missing message: ${key}`, {
    level: 'warning',
    tags: { i18n_key: key },
  });
}
