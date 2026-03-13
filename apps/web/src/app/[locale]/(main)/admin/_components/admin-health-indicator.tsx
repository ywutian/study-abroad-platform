'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';

interface HealthData {
  status: string;
  components: Record<string, { status: string; details?: any }>;
}

interface AdminHealthIndicatorProps {
  health: HealthData | undefined;
}

export function AdminHealthIndicator({ health }: AdminHealthIndicatorProps) {
  const t = useTranslations('admin');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.05 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5" />
            {t('dashboard.systemHealth')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {health.status === 'healthy' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-amber-500" />
                )}
                <span className="font-medium capitalize">{health.status}</span>
                <Badge variant={health.status === 'healthy' ? 'success' : 'warning'}>
                  {health.status === 'healthy'
                    ? t('dashboard.allOperational')
                    : t('dashboard.degraded')}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(health.components).map(([name, component]) => (
                  <div key={name} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        component.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
                      )}
                    />
                    <span className="text-sm capitalize">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('dashboard.loadingHealth')}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
