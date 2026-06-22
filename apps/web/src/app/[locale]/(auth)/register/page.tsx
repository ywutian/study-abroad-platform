'use client';

import { useRef, useState, type BaseSyntheticEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { PASSWORD_POLICY, isPasswordCompliant, profileRoutes } from '@study-abroad/shared';
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

function writeRegisterDebug(value: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    const existingRaw = window.sessionStorage.getItem('__registerDebug');
    const existing = existingRaw ? (JSON.parse(existingRaw) as { events?: unknown[] }) : null;
    const events = Array.isArray(existing?.events) ? existing.events : [];
    window.sessionStorage.setItem(
      '__registerDebug',
      JSON.stringify({
        events: [
          ...events,
          {
            ...value,
            capturedAt: new Date().toISOString(),
          },
        ],
      })
    );
  } catch {
    // Ignore sessionStorage failures in private browsing.
  }
}

export default function RegisterPage() {
  const t = useTranslations();
  const ta = useTranslations('auth.register');
  const locale = useLocale();
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
  const formRef = useRef<HTMLFormElement>(null);
  const [scoreValues, setScoreValues] = useState({
    toeflScore: '',
    ieltsScore: '',
    satScore: '',
    actScore: '',
  });
  const scoreValuesRef = useRef(scoreValues);

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

  const onSubmit = async (data: RegisterForm, event?: BaseSyntheticEvent) => {
    setIsLoading(true);
    try {
      const formElement =
        event?.currentTarget instanceof HTMLFormElement ? event.currentTarget : formRef.current;
      const readFormDataValue = (name: keyof RegisterForm) => {
        const snapshot = formElement ? new FormData(formElement) : null;
        const value = snapshot?.get(name);
        return typeof value === 'string' ? value.trim() : '';
      };
      const readDomValue = (name: keyof RegisterForm) => {
        const field = formElement?.querySelector(`[name="${String(name)}"]`);
        if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement ||
          field instanceof HTMLSelectElement
        ) {
          return field.value.trim();
        }
        return '';
      };
      const currentValues = form.getValues();
      const registerValues = {
        email:
          readDomValue('email') || readFormDataValue('email') || currentValues.email || data.email,
        password: currentValues.password || data.password,
        referralCode:
          readDomValue('referralCode') ||
          readFormDataValue('referralCode') ||
          currentValues.referralCode ||
          data.referralCode,
      };
      const res = (await apiClient.post(
        '/auth/register',
        {
          email: registerValues.email,
          password: registerValues.password,
          locale,
          ...(registerValues.referralCode ? { referralCode: registerValues.referralCode } : {}),
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
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      const onboardingCurrentValues = form.getValues();
      const scoreFieldMap = {
        toeflScore: scoreValuesRef.current.toeflScore,
        ieltsScore: scoreValuesRef.current.ieltsScore,
        satScore: scoreValuesRef.current.satScore,
        actScore: scoreValuesRef.current.actScore,
      } satisfies Record<'toeflScore' | 'ieltsScore' | 'satScore' | 'actScore', string>;
      const readOnboardingValue = (
        name:
          | 'realName'
          | 'birthYear'
          | 'birthMonth'
          | 'birthDay'
          | 'gradYear'
          | 'gradMonth'
          | 'toeflScore'
          | 'ieltsScore'
          | 'satScore'
          | 'actScore'
      ) => {
        const currentValue = onboardingCurrentValues[name];
        const formValue = data[name];
        const scoreValue =
          name in scoreFieldMap ? scoreFieldMap[name as keyof typeof scoreFieldMap] : '';
        return (
          readDomValue(name) ||
          scoreValue ||
          readFormDataValue(name) ||
          (typeof currentValue === 'string' ? currentValue : '') ||
          (typeof formValue === 'string' ? formValue : '')
        );
      };
      const resolvedValues: RegisterForm = {
        email: registerValues.email,
        password: registerValues.password,
        confirmPassword: onboardingCurrentValues.confirmPassword || data.confirmPassword,
        agreeTerms: onboardingCurrentValues.agreeTerms || data.agreeTerms,
        realName: readOnboardingValue('realName') || '',
        birthYear: readOnboardingValue('birthYear') || '',
        birthMonth: readOnboardingValue('birthMonth') || '',
        birthDay: readOnboardingValue('birthDay') || '',
        gradYear: readOnboardingValue('gradYear') || '',
        gradMonth: readOnboardingValue('gradMonth') || '',
        toeflScore: readOnboardingValue('toeflScore') || '',
        ieltsScore: readOnboardingValue('ieltsScore') || '',
        satScore: readOnboardingValue('satScore') || '',
        actScore: readOnboardingValue('actScore') || '',
        referralCode: registerValues.referralCode || '',
      };

      const birthday =
        resolvedValues.birthYear && resolvedValues.birthMonth && resolvedValues.birthDay
          ? `${resolvedValues.birthYear}-${resolvedValues.birthMonth}-${resolvedValues.birthDay}`
          : null;

      const graduationDate =
        resolvedValues.gradYear && resolvedValues.gradMonth
          ? `${resolvedValues.gradYear}-${resolvedValues.gradMonth}-01`
          : null;

      const onboardingData = {
        realName: resolvedValues.realName,
        birthday,
        graduationDate,
        testScores: [
          ...(resolvedValues.toeflScore
            ? [{ type: 'TOEFL', score: parseInt(resolvedValues.toeflScore, 10) }]
            : []),
          ...(resolvedValues.ieltsScore
            ? [{ type: 'IELTS', score: parseFloat(resolvedValues.ieltsScore) }]
            : []),
          ...(resolvedValues.satScore
            ? [{ type: 'SAT', score: parseInt(resolvedValues.satScore, 10) }]
            : []),
          ...(resolvedValues.actScore
            ? [{ type: 'ACT', score: parseInt(resolvedValues.actScore, 10) }]
            : []),
        ],
      };
      writeRegisterDebug({
        phase: 'before-onboarding-post',
        scoreValuesRef: { ...scoreValuesRef.current },
        currentValues: onboardingCurrentValues,
        domValues: {
          email: readDomValue('email'),
          realName: readDomValue('realName'),
          toeflScore: readDomValue('toeflScore'),
          ieltsScore: readDomValue('ieltsScore'),
          satScore: readDomValue('satScore'),
          actScore: readDomValue('actScore'),
        },
        snapshotValues: {
          email: readFormDataValue('email'),
          realName: readFormDataValue('realName'),
          toeflScore: readFormDataValue('toeflScore'),
          ieltsScore: readFormDataValue('ieltsScore'),
          satScore: readFormDataValue('satScore'),
          actScore: readFormDataValue('actScore'),
        },
        resolvedValues,
        onboardingData,
      });

      // POST onboarding data directly (auth token already in memory from setAuthFromLogin)
      try {
        await apiClient.post(profileRoutes.onboarding(), onboardingData, {
          headers: {
            Authorization: `Bearer ${res.accessToken}`,
          },
        });
        writeRegisterDebug({
          phase: 'onboarding-post-succeeded',
          scoreValuesRef: { ...scoreValuesRef.current },
          resolvedValues,
          onboardingData,
        });
      } catch {
        // Fallback: store in sessionStorage for dashboard retry
        try {
          sessionStorage.setItem('pendingOnboarding', JSON.stringify(onboardingData));
        } catch {
          /* private browsing */
        }
        writeRegisterDebug({
          phase: 'onboarding-post-failed',
          scoreValuesRef: { ...scoreValuesRef.current },
          resolvedValues,
          onboardingData,
          pendingOnboardingStored: true,
        });
      }

      toast.success(t('auth.register.success'));
      try {
        localStorage.setItem('showQuickExperience', 'true');
      } catch {
        /* private browsing */
      }
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
            ref={formRef}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (isLastStep) {
                void form.handleSubmit((values, submitEvent) => onSubmit(values, submitEvent))(e);
              } else {
                void handleNext();
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
                <RegisterStepScores
                  form={form}
                  values={scoreValues}
                  onValueChange={(field, value) => {
                    const nextValues = { ...scoreValuesRef.current, [field]: value };
                    scoreValuesRef.current = nextValues;
                    setScoreValues(nextValues);
                  }}
                />
                <p className="mt-3 text-xs text-muted-foreground">{ta('scoresOptionalHint')}</p>
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
