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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

const registerSchema: ZodType<RegisterFormData> = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    agreeTerms: z.boolean().refine((val) => val === true),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<RegisterFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(registerSchema as any),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      await apiClient.post('/auth/register', {
        email: data.email,
        password: data.password,
      }, { skipAuth: true });
      toast.success(t('common.success'));
      router.push('/verify-email?email=' + encodeURIComponent(data.email));
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
          {t('auth.register.title')}
        </h1>
        <p className="text-sm text-auth-subtle">
          {t('auth.register.subtitle')}
        </p>
      </div>

      {/* 表单 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-sm font-medium text-auth-muted">
                  {t('auth.register.email')}
                </FormLabel>
                <FormControl>
                  <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
                      <Mail className="h-4 w-4 text-auth-icon group-focus-within:text-auth-icon-focus transition-colors" />
                    </div>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      className="h-11 pl-11 pr-4 bg-auth-input-bg border-auth-input-border text-auth-input-text placeholder:text-auth-input-placeholder rounded-xl focus:bg-[var(--auth-card-bg)] focus:border-[var(--auth-focus-border)] focus:ring-2 focus:ring-[var(--auth-focus-ring)] transition-all"
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
                  {t('auth.register.password')}
                </FormLabel>
                <FormControl>
                  <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
                      <Lock className="h-4 w-4 text-auth-icon group-focus-within:text-auth-icon-focus transition-colors" />
                    </div>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="h-11 pl-11 pr-11 bg-auth-input-bg border-auth-input-border text-auth-input-text placeholder:text-auth-input-placeholder rounded-xl focus:bg-[var(--auth-card-bg)] focus:border-[var(--auth-focus-border)] focus:ring-2 focus:ring-[var(--auth-focus-ring)] transition-all"
                      autoComplete="new-password"
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

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-sm font-medium text-auth-muted">
                  {t('auth.register.confirmPassword')}
                </FormLabel>
                <FormControl>
                  <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
                      <ShieldCheck className="h-4 w-4 text-auth-icon group-focus-within:text-auth-icon-focus transition-colors" />
                    </div>
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="h-11 pl-11 pr-11 bg-auth-input-bg border-auth-input-border text-auth-input-text placeholder:text-auth-input-placeholder rounded-xl focus:bg-[var(--auth-card-bg)] focus:border-[var(--auth-focus-border)] focus:ring-2 focus:ring-[var(--auth-focus-ring)] transition-all"
                      autoComplete="new-password"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center text-auth-icon hover:text-auth-text-muted transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-[var(--auth-error)] text-xs" />
              </FormItem>
            )}
          />

          {/* 同意条款 */}
          <FormField
            control={form.control}
            name="agreeTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-1">
                <FormControl>
                  <Checkbox 
                    checked={field.value} 
                    onCheckedChange={field.onChange}
                    className="border-[var(--auth-input-border)] data-[state=checked]:bg-[var(--auth-checkbox-checked)] data-[state=checked]:border-[var(--auth-checkbox-checked)]"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal text-auth-subtle leading-relaxed">
                    {t('auth.register.agreeText') || '我已阅读并同意'}{' '}
                    <Link href="/terms" className="text-[var(--auth-link)] hover:text-[var(--auth-link-hover)] transition-colors">
                      {t('auth.register.terms') || '服务条款'}
                    </Link>
                    {' '}{t('auth.register.and') || '和'}{' '}
                    <Link href="/privacy" className="text-[var(--auth-link)] hover:text-[var(--auth-link-hover)] transition-colors">
                      {t('auth.register.privacy') || '隐私政策'}
                    </Link>
                  </FormLabel>
                  <FormMessage className="text-[var(--auth-error)] text-xs" />
                </div>
              </FormItem>
            )}
          />

          {/* 注册按钮 */}
          <Button 
            type="submit" 
            className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.loading')}
              </>
            ) : (
              <>
                {t('common.register')}
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
          <span className="px-3 bg-auth-card-bg text-auth-subtle">{t('auth.register.or') || '或'}</span>
        </div>
      </div>

      {/* 登录链接 */}
      <div className="text-center">
        <p className="text-sm text-auth-subtle">
          {t('auth.register.hasAccount')}{' '}
          <Link 
            href="/login" 
            className="font-medium text-[var(--auth-link)] hover:text-[var(--auth-link-hover)] transition-colors"
          >
            {t('auth.register.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
