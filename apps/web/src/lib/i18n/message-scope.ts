/**
 * 客户端字典分域 —— 决定「哪些 namespace 不发给普通用户」。
 *
 * 背景：所有界面文案都会被序列化进 RSC payload 发到浏览器。实测 `admin`
 * 一个 namespace 占 zh 的 26.5% / en 的 24.9%（zh 234.5KB 里的 62.1KB），
 * 而 `/admin/*` 有角色门禁，普通学生用户永远进不去 —— 等于每次访问都在白下载。
 *
 * 为什么按 namespace 而不是按 key 切：namespace 是**静态可判定**的。
 * 全仓 581 处 `useTranslations()` 的 namespace 参数无一是变量；88 处无参调用
 * 里的动态 key 也全部带静态前缀（`t(\`profile.tabStatus.${x}\`)`）。key 级别
 * 则不可判定（280+ 个 key 只能靠运行时拼出来），切了就是线上露原始 key。
 *
 * 加新的分域 namespace 前必须先跑 `pnpm --filter web lint:i18n-scope`，
 * 它会静态验证「域外没有人引用这个 namespace」。
 */

/**
 * 只有 `/admin/*` 路由树内才允许引用的 namespace。
 *
 * 与 `scripts/check-i18n-scope.ts` 共用此常量 —— 护栏和实现读同一份定义，
 * 不会漂。
 */
export const ADMIN_ONLY_NAMESPACES = ['admin'] as const;

/**
 * 剥掉仅 admin 需要的 namespace，用于根 layout 的 provider。
 *
 * 注意 next-intl 的嵌套 provider 是**替换**语义不是合并
 * （use-intl `IntlProvider`: `messages === undefined ? prevContext?.messages : messages`），
 * 所以 `admin/layout.tsx` 里补回来时必须传全量，不能只传 admin 那一块。
 */
export function stripAdminNamespaces<T extends Record<string, unknown>>(messages: T): T {
  const scoped: Record<string, unknown> = { ...messages };
  for (const ns of ADMIN_ONLY_NAMESPACES) {
    delete scoped[ns];
  }
  return scoped as T;
}
