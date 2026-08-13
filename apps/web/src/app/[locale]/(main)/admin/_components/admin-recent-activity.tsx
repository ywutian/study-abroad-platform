'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Link } from '@/lib/i18n/navigation';
import { Clock } from 'lucide-react';

interface ActivityLog {
  id: string;
  action: string;
  resource: string;
  details?: string;
  createdAt: string;
  admin?: { displayName?: string };
}

interface AdminRecentActivityProps {
  recentActivity: { data: ActivityLog[] } | undefined;
}

export function AdminRecentActivity({ recentActivity }: AdminRecentActivityProps) {
  const t = useTranslations('admin');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.1 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-body">
            <Clock className="h-5 w-5" />
            {t('dashboard.recentActivity')}
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/audit-logs">{t('dashboard.viewAll')}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentActivity?.data && recentActivity.data.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.data.slice(0, 6).map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-md border px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      <span className="text-muted-foreground">
                        {log.admin?.displayName || t('dashboard.system')}
                      </span>{' '}
                      <Badge variant="outline" className="text-xs mx-1">
                        {log.action}
                      </Badge>{' '}
                      <span className="text-muted-foreground">{log.resource}</span>
                    </p>
                    {log.details && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{log.details}</p>
                    )}
                  </div>
                  <span className="text-2xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('dashboard.noActivity')}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
