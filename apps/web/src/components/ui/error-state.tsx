import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw, WifiOff, ServerCrash, ShieldX } from 'lucide-react';
import { Button } from './button';

type ErrorVariant = 'default' | 'network' | 'server' | 'permission' | 'notFound';

const variantConfig = {
  default: {
    icon: AlertTriangle,
    title: '出错了',
    description: '发生了一些错误，请稍后重试',
  },
  network: {
    icon: WifiOff,
    title: '网络连接失败',
    description: '请检查您的网络连接后重试',
  },
  server: {
    icon: ServerCrash,
    title: '服务器错误',
    description: '服务器暂时无法处理您的请求',
  },
  permission: {
    icon: ShieldX,
    title: '没有权限',
    description: '您没有权限访问此内容',
  },
  notFound: {
    icon: AlertTriangle,
    title: '未找到',
    description: '请求的资源不存在',
  },
};

interface ErrorStateProps {
  variant?: ErrorVariant;
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  variant = 'default',
  title,
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center',
        className
      )}
    >
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <Icon className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="mb-1 text-lg font-semibold">{title || config.title}</h3>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">
        {description || config.description}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          重试
        </Button>
      )}
    </div>
  );
}





