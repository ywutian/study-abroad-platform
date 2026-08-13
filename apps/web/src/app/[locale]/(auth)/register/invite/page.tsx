'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordStrength } from '@/components/ui/password-strength';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/api/api-error';
import { setAuthFromLogin } from '@/stores/auth';
import { Loader2, Shield, AlertCircle, Lock } from 'lucide-react';
import { PASSWORD_POLICY, isPasswordCompliant } from '@study-abroad/shared';

const createSchema = (t: ReturnType<typeof useTranslations>) =>
  z
    .object({
      email: z.string().email({ message: t('validation.invalidEmail') }),
      password: z
        .string()
        .min(PASSWORD_POLICY.minLength, { message: t('validation.passwordMin') })
        .max(PASSWORD_POLICY.maxLength, {
          message: t('validation.passwordMax', { max: PASSWORD_POLICY.maxLength }),
        })
        .refine(isPasswordCompliant, {
          message: t('validation.passwordStrength'),
        }),
      confirmPassword: z
        .string()
        .min(PASSWORD_POLICY.minLength, { message: t('validation.passwordMin') })
        .max(PASSWORD_POLICY.maxLength, {
          message: t('validation.passwordMax', { max: PASSWORD_POLICY.maxLength }),
        }),
      agreeTerms: z
        .boolean()
        .refine((val) => val === true, { message: t('validation.agreeRequired') }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmPassword'],
    });

type FormValues = z.infer<ReturnType<typeof createSchema>>;

export default function InviteRegisterPage() {
  const t = useTranslations();
  const ti = useTranslations('auth.register.invite');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const schema = createSchema(t);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false,
    },
  });

  const watchedPassword = watch('password');
  const watchedAgree = watch('agreeTerms');

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-title font-bold">{ti('invalidToken')}</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/login">{t('auth.login.title')}</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError('');
    try {
      const res = (await apiClient.post(
        '/auth/register/operator',
        {
          email: data.email,
          password: data.password,
          inviteToken: token,
        },
        { skipAuth: true }
      )) as {
        user: {
          id: string;
          email: string;
          role: 'USER' | 'VERIFIED' | 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN';
          emailVerified: boolean;
          locale: string;
        };
        accessToken: string;
      };

      setAuthFromLogin(res.user, res.accessToken);
      toast.success(ti('success'));
      router.push('/dashboard');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.displayMessage
          : err instanceof Error
            ? err.message
            : ti('invalidToken');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
        </div>
        <h1 className="text-title font-bold">{ti('title')}</h1>
        <p className="text-sm text-muted-foreground">{ti('subtitle')}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.register.email')}</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.register.password')}</Label>
          <Input id="password" type="password" {...register('password')} />
          <PasswordStrength password={watchedPassword} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('auth.register.confirmPassword')}</Label>
          <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Terms */}
        <div className="flex items-start gap-2">
          <Checkbox
            id="agreeTerms"
            checked={watchedAgree}
            onCheckedChange={(checked) =>
              setValue('agreeTerms', checked === true, { shouldValidate: true })
            }
          />
          <label
            htmlFor="agreeTerms"
            className="text-xs text-muted-foreground cursor-pointer leading-relaxed"
          >
            {t('auth.register.agreeTerms')}
          </label>
        </div>
        {errors.agreeTerms && (
          <p className="text-xs text-destructive">{errors.agreeTerms.message}</p>
        )}

        <Button type="submit" className="w-full gap-2" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {ti('submit')}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {ti('hasAccount')}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('auth.register.signIn')}
        </Link>
      </p>
    </div>
  );
}
