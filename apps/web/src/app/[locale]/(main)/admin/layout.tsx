import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { AdminShell } from './_components/admin-shell';

/**
 * 根 layout 的 provider 剥掉了 `admin` 字典（`lib/i18n/message-scope.ts`），
 * 这里把它补回来 —— 只有进到 `/admin/*` 的用户才会下载这 62.1KB(zh) / 90.9KB(en)。
 *
 * 必须是 Server Component：只有从 Server Component 渲染，
 * `NextIntlClientProvider` 才会走服务端变体，自动补上 `locale` / `formats` /
 * `timeZone` / `now`。包一层 'use client' 转发 props 会静默废掉这套补全
 * （locale 会报错，日期格式和 Asia/Shanghai 时区则是无声降级）。
 *
 * 传全量而不是只传 `{ admin }`：next-intl 的嵌套 provider 是替换语义不是合并
 * （use-intl `IntlProvider`），只传 admin 会让后台组件读不到 `common`/`ui` 这些。
 *
 * ponytail: 代价是 admin 页面的 payload 里字典出现两份（根的 172.3KB + 这里的
 * 234.5KB）。admin 是内部角色、桌面端、量小，先认这个成本。真要去重就得把根
 * provider 下沉到各路由段各自提供 —— 那需要按路由解析组件图，共享组件跨路由
 * 用，静态判不准，收益也远小于本次这 26.5%。
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <AdminShell>{children}</AdminShell>
    </NextIntlClientProvider>
  );
}
