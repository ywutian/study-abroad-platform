'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toastLoginSuccess, toastError, toastSuccess, toastWarning } from '@/components/ui/sonner';
import { setAuthFromLogin } from '@/stores';
import { apiClient } from '@/lib/api';
import { Loader2 } from 'lucide-react';

type LoginForm = z.infer<ReturnType<typeof createLoginSchema>>;

const createLoginSchema = (t: ReturnType<typeof useTranslations>) =>
  z.object({
    email: z.string().email({ message: t('validation.invalidEmail') }),
    password: z.string().min(8, { message: t('validation.passwordMin') }),
  });

export default function LoginPage() {
  const t = useTranslations();
  const loginSchema = createLoginSchema(t);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const hasShownParamToast = useRef(false);

  // 处理 URL 参数提示（邮箱验证成功/失败后跳转）
  useEffect(() => {
    if (hasShownParamToast.current) return;

    const verified = searchParams.get('verified');
    const error = searchParams.get('error');

    if (verified === 'true') {
      toastSuccess(t('auth.verifyEmail.emailVerifiedSuccess'));
      hasShownParamToast.current = true;
    } else if (error === 'invalid_token') {
      toastError(t('auth.verifyEmail.emailVerifiedError'));
      hasShownParamToast.current = true;
    }
  }, [searchParams, t]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post<{
        user: {
          id: string;
          email: string;
          role: 'USER' | 'VERIFIED' | 'ADMIN';
          emailVerified: boolean;
          locale: string;
        };
        accessToken: string;
        isNewUser: boolean;
      }>('/auth/login', data, { skipAuth: true });

      // 使用 setAuthFromLogin 设置认证状态并启动自动刷新
      setAuthFromLogin(response.user, response.accessToken);

      // Mark new users for onboarding quick experience on dashboard
      if (response.isNewUser) {
        localStorage.setItem('showQuickExperience', 'true');
      }

      // 提取用户名（邮箱@前的部分）用于欢迎提示
      const userName = response.user.email.split('@')[0];
      toastLoginSuccess(
        t('auth.login.welcomeBack'),
        t('auth.login.welcomeDesc', { name: userName })
      );

      // 邮箱未验证时显示提醒（不阻塞登录）
      if (!response.user.emailVerified) {
        setTimeout(() => {
          toastWarning(t('auth.verifyEmail.emailNotVerifiedWarning'), {
            action: {
              label: t('auth.verifyEmail.emailNotVerifiedAction'),
              onClick: () => {
                apiClient
                  .post('/auth/resend-verification', { email: response.user.email })
                  .catch(() => {});
              },
            },
            duration: 8000,
          });
        }, 1000);
      }

      // 优先使用 callbackUrl 跳转，否则根据角色跳转
      const callbackUrl = searchParams.get('callbackUrl');
      const defaultPath = response.user.role === 'ADMIN' ? '/admin' : '/dashboard';
      // 提取路径（去掉 locale 前缀），安全校验只允许站内跳转
      const targetPath = callbackUrl
        ? callbackUrl.replace(/^\/(zh|en)/, '') || defaultPath
        : defaultPath;

      // 延迟跳转，让用户看到欢迎提示
      setTimeout(() => {
        router.push(targetPath);
      }, 600);
    } catch (error) {
      toastError(error instanceof Error ? error.message : t('errors.networkError'));
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{t('auth.login.title')}</CardTitle>
        <CardDescription>{t('auth.login.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.login.email')}</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.login.password')}</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center justify-end">
              <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                {t('auth.login.forgotPassword')}
              </Link>
            </div>
            <Button type="submit" className="w-full relative" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  {t('common.loading')}
                </span>
              ) : (
                t('common.login')
              )}
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center text-sm text-slate-500">
          {t('auth.login.noAccount')}{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            {t('auth.login.signUp')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
