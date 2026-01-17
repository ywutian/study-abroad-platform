import { getRequestConfig } from 'next-intl/server';
import { locales, type Locale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !locales.includes(locale as Locale)) {
    locale = 'zh';
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Asia/Shanghai',
    formats: {
      dateTime: {
        // 短格式: "2月7日" / "Feb 7"
        short: {
          month: 'short',
          day: 'numeric',
        },
        // 中等格式: "2026年2月7日" / "Feb 7, 2026"
        medium: {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        },
        // 长格式: "2026年2月7日 星期六" / "Saturday, February 7, 2026"
        long: {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        },
        // 仅时间: "14:30" / "02:30 PM"
        time: {
          hour: '2-digit',
          minute: '2-digit',
        },
      },
      number: {
        // 标准整数格式: "12,345" / "12,345"
        standard: {
          maximumFractionDigits: 0,
        },
        // 精确小数格式: "3.85"
        precise: {
          maximumFractionDigits: 2,
        },
        // 美元货币: "$50,000"
        currency: {
          style: 'currency',
          currency: 'USD',
        },
        // 紧凑格式: "1.2K" / "1.2万"
        compact: {
          notation: 'compact',
          maximumFractionDigits: 1,
        },
      },
    },
  };
});
