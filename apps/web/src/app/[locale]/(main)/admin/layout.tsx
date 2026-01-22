'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores';
import { useRouter } from '@/lib/i18n/navigation';
import { AdminSidebar } from './_components/admin-sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.push('/profile');
    }
  }, [user, router]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="relative">
      <AdminSidebar />
      <div className="md:pl-56">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-2">{children}</div>
      </div>
    </div>
  );
}
