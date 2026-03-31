'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/api/api-error';
import { setAuthFromLogin } from '@/stores/auth';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { RegisterProgress } from './_components/register-progress';
import { RegisterStepAccount } from './_components/register-step-account';
import { RegisterStepProfile } from './_components/register-step-profile';
import { RegisterStepScores } from './_components/register-step-scores';

// Form Schema
const createRegisterSchema = (t: ReturnType<typeof useTranslations>) =>
  z
    .object({
      email: z.string().email({ message: t('validation.invalidEmail') }),
      password: z
        .string()
        .min(8, { message: t('validation.passwordMin') })
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/, {
          message: t('validation.passwordStrength'),
        }),
      confirmPassword: z.string().min(8, { message: t('validation.passwordMin') }),
      agreeTerms: z
        .boolean()
        .refine((val) => val === true, { message: t('validation.agreeRequired') }),
      realName: z.string().min(1, { message: t('validation.required') }),
      birthYear: z.string().optional(),
      birthMonth: z.string().optional(),
      birthDay: z.string().optional(),
      gradYear: z.string().optional(),
      gradMonth: z.string().optional(),
      toeflScore: z.string().optional(),
      ieltsScore: z.string().optional(),
      satScore: z.string().optional(),
      actScore: z.string().optional(),
      referralCode: z.string().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmPassword'],
    });

type RegisterForm = z.infer<ReturnType<typeof createRegisterSchema>>;

export default function RegisterPage() {
  const t = useTranslations();
  const ta = useTranslations('auth.register');
  const registerSchema = createRegisterSchema(t);
  const searchParams = useSearchParams();
  const refCode = (searchParams.get('ref') || '').toUpperCase();

  const steps = [
    { key: 'account', label: ta('steps.account.title') },
    { key: 'profile', label: ta('steps.profile.title') },
    { key: 'scores', label: ta('steps.scores.title') },
  ];
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [referralOpen, setReferralOpen] = useState(!!refCode);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false,
      realName: '',
      birthYear: '',
      birthMonth: '',
      birthDay: '',
      gradYear: '',
      gradMonth: '',
      toeflScore: '',
      ieltsScore: '',
      satScore: '',
      actScore: '',
      referralCode: refCode,
    },
    mode: 'onChange',
  });

  const watchedPassword = form.watch('password');

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const validateCurrentStep = async () => {
    let fieldsToValidate: (keyof RegisterForm)[] = [];
    switch (currentStep) {
      case 0:
        fieldsToValidate = ['email', 'password', 'confirmPassword', 'agreeTerms'];
        break;
      case 1:
        fieldsToValidate = ['realName'];
        break;
      case 2:
        return true;
    }
    const valid = await form.trigger(fieldsToValidate);
    // Schema-level refine (password match) isn't triggered by field-level trigger,
    // so check it manually on step 0
    if (valid && currentStep === 0) {
      const { password, confirmPassword } = form.getValues();
      if (password !== confirmPassword) {
        form.setError('confirmPassword', {
          type: 'manual',
          message: t('validation.passwordMismatch'),
        });
        return false;
      }
    }
    return valid;
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const res = (await apiClient.post(
        '/auth/register',
        {
          email: data.email,
          password: data.password,
          ...(data.referralCode ? { referralCode: data.referralCode } : {}),
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

      // Auto-login: store auth state from register response
      setAuthFromLogin(res.user, res.accessToken);

      const birthday =
        data.birthYear && data.birthMonth && data.birthDay
          ? `${data.birthYear}-${data.birthMonth}-${data.birthDay}`
          : null;

      const graduationDate =
        data.gradYear && data.gradMonth ? `${data.gradYear}-${data.gradMonth}-01` : null;

      const onboardingData = {
        realName: data.realName,
        birthday,
        graduationDate,
        testScores: [
          ...(data.toeflScore ? [{ type: 'TOEFL', score: parseInt(data.toeflScore, 10) }] : []),
          ...(data.ieltsScore ? [{ type: 'IELTS', score: parseFloat(data.ieltsScore) }] : []),
          ...(data.satScore ? [{ type: 'SAT', score: parseInt(data.satScore, 10) }] : []),
          ...(data.actScore ? [{ type: 'ACT', score: parseInt(data.actScore, 10) }] : []),
        ],
      };

      // POST onboarding data directly (auth token already in memory from setAuthFromLogin)
      try {
        await apiClient.post('/profiles/onboarding', onboardingData);
      } catch {
        // Fallback: store in sessionStorage for dashboard retry
        try {
          sessionStorage.setItem('pendingOnboarding', JSON.stringify(onboardingData));
        } catch {
          /* private browsing */
        }
      }

      toast.success(t('auth.register.success'));
      const callbackUrl = searchParams.get('callbackUrl');
      const rawPath = callbackUrl?.replace(/^\/(zh|en)/, '') || '';
      const targetPath =
        rawPath && /^\/[\w\-/]*(\?[\w\-=&%.]*)?$/.test(rawPath) ? rawPath : '/dashboard';
      router.push(targetPath);
    } catch (error) {
      const msg =
        error instanceof ApiError
          ? error.displayMessage
          : error instanceof Error
            ? error.message
            : t('errors.networkError');
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <RegisterProgress steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} />

        {/* Form — all steps rendered simultaneously, inactive ones hidden via CSS
             so fields stay mounted and react-hook-form retains their values */}
        <Form {...form}>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (isLastStep) {
                form.handleSubmit(onSubmit)();
              } else {
                handleNext();
              }
            }}
          >
            <div className="min-h-[260px]">
              {/* Step 0: Account */}
              <div className={cn(currentStep !== 0 && 'hidden')}>
                <RegisterStepAccount
                  form={form}
                  watchedPassword={watchedPassword}
                  referralOpen={referralOpen}
                  onReferralOpenChange={setReferralOpen}
                />
              </div>

              {/* Step 1: Profile */}
              <div className={cn(currentStep !== 1 && 'hidden')}>
                <RegisterStepProfile form={form} />
              </div>

              {/* Step 2: Scores */}
              <div className={cn(currentStep !== 2 && 'hidden')}>
                <RegisterStepScores form={form} />
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between items-center pt-6 mt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                className={cn(isFirstStep && 'invisible')}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t('common.previous')}
              </Button>

              {isLastStep ? (
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('common.processing')}
                    </>
                  ) : (
                    <>{ta('title')}</>
                  )}
                </Button>
              ) : (
                <Button type="button" onClick={handleNext}>
                  {t('common.next')}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </form>
        </Form>

        {/* Bottom link */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          {ta('hasAccount')}
          <Link href="/login" className="text-primary font-medium hover:underline ml-1">
            {ta('signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
