'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores';
import { useRouter } from '@/lib/i18n/navigation';
import { AdminSidebar } from './_components/admin-sidebar';
import { AdminBreadcrumb } from './_components/admin-breadcrumb';

const ADMIN_ROLES = ['OPERATOR', 'ADMIN', 'SUPER_ADMIN'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
          {children}
        </div>
      </div>
    </div>
  );
}
