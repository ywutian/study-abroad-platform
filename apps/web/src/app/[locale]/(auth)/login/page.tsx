'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z, type ZodType } from 'zod';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { setAuthFromLogin } from '@/stores/auth';
import { apiClient } from '@/lib/api';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';

interface LoginFormData {
  email: string;
  password: string;
}

const loginSchema: ZodType<LoginFormData> = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(loginSchema as any),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      // apiClient 自动解包 data 字段，返回 { user, accessToken }
      const response = await apiClient.post<{
        user: { id: string; email: string; role: 'USER' | 'VERIFIED' | 'ADMIN'; emailVerified: boolean; locale: string };
        accessToken: string;
      }>('/auth/login', data, { skipAuth: true });

      // 使用安全的认证设置函数
      // accessToken 仅存储在内存中，refreshToken 由浏览器 cookie 管理
      setAuthFromLogin(response.user, response.accessToken);
      toast.success(t('common.success'));
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-auth tracking-tight">
          {t('auth.login.title')}
        </h1>
        <p className="text-sm text-auth-subtle">
          {t('auth.login.subtitle')}
        </p>
      </div>

      {/* 表单 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-sm font-medium text-auth-muted">
                  {t('auth.login.email')}
                </FormLabel>
                <FormControl>
                  <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
                      <Mail className="h-4 w-4 text-auth-icon group-focus-within:text-auth-icon-focus transition-colors" />
                    </div>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      className="h-12 pl-11 pr-4 bg-auth-input-bg border-auth-input-border text-auth-input-text placeholder:text-auth-input-placeholder rounded-xl focus:bg-[var(--auth-card-bg)] focus:border-[var(--auth-focus-border)] focus:ring-2 focus:ring-[var(--auth-focus-ring)] transition-all"
                      autoComplete="email"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-[var(--auth-error)] text-xs" />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-sm font-medium text-auth-muted">
                  {t('auth.login.password')}
                </FormLabel>
                <FormControl>
                  <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
                      <Lock className="h-4 w-4 text-auth-icon group-focus-within:text-auth-icon-focus transition-colors" />
                    </div>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="h-12 pl-11 pr-11 bg-auth-input-bg border-auth-input-border text-auth-input-text placeholder:text-auth-input-placeholder rounded-xl focus:bg-[var(--auth-card-bg)] focus:border-[var(--auth-focus-border)] focus:ring-2 focus:ring-[var(--auth-focus-ring)] transition-all"
                      autoComplete="current-password"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center text-auth-icon hover:text-auth-text-muted transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-[var(--auth-error)] text-xs" />
              </FormItem>
            )}
          />

          {/* 忘记密码链接 */}
          <div className="flex items-center justify-end">
            <Link 
              href="/forgot-password" 
              className="text-sm text-[var(--auth-link)] hover:text-[var(--auth-link-hover)] transition-colors"
            >
              {t('auth.login.forgotPassword')}
            </Link>
          </div>

          {/* 登录按钮 */}
          <Button 
            type="submit" 
            className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.loading')}
              </>
            ) : (
              <>
                {t('common.login')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </Form>

      {/* 分隔线 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-auth-divider" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-auth-card-bg text-auth-subtle">{t('auth.login.or') || '或'}</span>
        </div>
      </div>

      {/* 注册链接 */}
      <div className="text-center">
        <p className="text-sm text-auth-subtle">
          {t('auth.login.noAccount')}{' '}
          <Link 
            href="/register" 
            className="font-medium text-[var(--auth-link)] hover:text-[var(--auth-link-hover)] transition-colors"
          >
            {t('auth.login.signUp')}
          </Link>
        </p>
      </div>
    </div>
  );
}
