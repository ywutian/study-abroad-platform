'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores';
import { useRouter } from '@/lib/i18n/navigation';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { AdminSidebar } from './admin-sidebar';
import { AdminBreadcrumb } from './admin-breadcrumb';

const ADMIN_ROLES = ['OPERATOR', 'ADMIN', 'SUPER_ADMIN'];

/**
 * admin 的客户端外壳（角色门禁 + 侧边栏 + 面包屑）。
 *
 * 从 `admin/layout.tsx` 拆出来的：那个 layout 现在必须是 Server Component，
 * 才能用 `NextIntlClientProvider` 的服务端变体把 admin 字典补回去。
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const hasAdminAccess = user ? ADMIN_ROLES.includes(user.role) : false;

  useEffect(() => {
    if (user && !ADMIN_ROLES.includes(user.role)) {
      router.push('/profile');
    }
  }, [user, router]);

  if (!hasAdminAccess) {
    return null;
  }

  return (
    <div className="relative">
      <AdminSidebar />
      <div className="md:pl-56">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-2">
          <AdminBreadcrumb />
          <ErrorBoundary level="page">{children}</ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
