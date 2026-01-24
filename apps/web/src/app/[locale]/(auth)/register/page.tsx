'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react';

// 年份选项
const currentYear = new Date().getFullYear();
const birthYears = Array.from({ length: 50 }, (_, i) => currentYear - 10 - i);
const graduationYears = Array.from({ length: 10 }, (_, i) => currentYear + 5 - i);

// 月份选项
const months = Array.from({ length: 12 }, (_, i) => ({
  value: (i + 1).toString().padStart(2, '0'),
  label: `${i + 1}`,
}));

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month, 0).getDate();
};

// 步骤配置
// Step labels are resolved via translations in the component

// 表单 Schema
const createRegisterSchema = (t: ReturnType<typeof useTranslations>) =>
  z
    .object({
      email: z.string().email({ message: t('validation.invalidEmail') }),
      password: z.string().min(8, { message: t('validation.passwordMin') }),
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

  const steps = [
    { key: 'account', label: ta('steps.account.title') },
    { key: 'profile', label: ta('steps.profile.title') },
    { key: 'scores', label: ta('steps.scores.title') },
  ];
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

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
    },
    mode: 'onChange',
  });

  const watchBirthYear = form.watch('birthYear');
  const watchBirthMonth = form.watch('birthMonth');

  const daysInMonth = useMemo(() => {
    if (watchBirthYear && watchBirthMonth) {
      return getDaysInMonth(parseInt(watchBirthYear), parseInt(watchBirthMonth));
    }
    return 31;
  }, [watchBirthYear, watchBirthMonth]);

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
    return await form.trigger(fieldsToValidate);
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
      await apiClient.post(
        '/auth/register',
        {
          email: data.email,
          password: data.password,
        },
        { skipAuth: true }
      );

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
          ...(data.toeflScore ? [{ type: 'TOEFL', score: parseInt(data.toeflScore) }] : []),
          ...(data.ieltsScore ? [{ type: 'IELTS', score: parseFloat(data.ieltsScore) }] : []),
          ...(data.satScore ? [{ type: 'SAT', score: parseInt(data.satScore) }] : []),
          ...(data.actScore ? [{ type: 'ACT', score: parseInt(data.actScore) }] : []),
        ],
      };
      localStorage.setItem('pendingOnboarding', JSON.stringify(onboardingData));

      toast.success(t('auth.register.success'));
      router.push('/verify-email?email=' + encodeURIComponent(data.email));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ta('email')}</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="your@email.com" autoFocus {...field} />
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
                  <FormLabel>{ta('password')}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={t('validation.passwordMin')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ta('confirmPassword')}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={ta('confirmPassword')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="agreeTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="text-sm font-normal text-muted-foreground leading-snug cursor-pointer">
                    {ta('agreeTerms')}
                  </FormLabel>
                </FormItem>
              )}
            />
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="realName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {ta('realName')} <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={ta('realNamePlaceholder')} autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel className="text-sm">
                {ta('birthday')}{' '}
                <span className="text-muted-foreground font-normal text-xs ml-1">
                  {t('common.optional', { defaultValue: '' })}
                </span>
              </FormLabel>
              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={form.control}
                  name="birthYear"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="YYYY" />
                      </SelectTrigger>
                      <SelectContent>
                        {birthYears.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birthMonth"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birthDay"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="DD" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: daysInMonth }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString().padStart(2, '0')}>
                            {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <FormLabel className="text-sm">{ta('graduationDate')}</FormLabel>
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="gradYear"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="YYYY" />
                      </SelectTrigger>
                      <SelectContent>
                        {graduationYears.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gradMonth"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <FormField
                control={form.control}
                name="toeflScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">
                      TOEFL <span className="text-muted-foreground font-normal text-xs">/ 120</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="-" min={0} max={120} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ieltsScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">
                      IELTS <span className="text-muted-foreground font-normal text-xs">/ 9.0</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="-" min={0} max={9} step={0.5} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="satScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">
                      SAT <span className="text-muted-foreground font-normal text-xs">/ 1600</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="-" min={400} max={1600} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="actScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">
                      ACT <span className="text-muted-foreground font-normal text-xs">/ 36</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="-" min={1} max={36} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center pt-2">{ta('scoresOptional')}</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {/* 步骤指示器 */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((step, index) => (
            <div key={step.key} className="flex items-center">
              {/* 步骤圆圈 */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => index < currentStep && setCurrentStep(index)}
                  disabled={index > currentStep}
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                    index < currentStep &&
                      'bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90',
                    index === currentStep &&
                      'bg-primary text-primary-foreground ring-4 ring-primary/20',
                    index > currentStep && 'bg-muted text-muted-foreground'
                  )}
                >
                  {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
                </button>
                <span
                  className={cn(
                    'text-xs mt-1.5',
                    index === currentStep ? 'text-primary font-medium' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* 连接线 */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'w-16 h-0.5 mx-2 -mt-5',
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* 标题区 */}
        <div className="text-center mb-6">
          <h1 className="text-title">
            {currentStep === 0 && ta('steps.account.title')}
            {currentStep === 1 && ta('steps.profile.title')}
            {currentStep === 2 && ta('steps.scores.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentStep === 0 && ta('steps.account.desc')}
            {currentStep === 1 && ta('steps.profile.desc')}
            {currentStep === 2 && ta('steps.scores.desc')}
          </p>
        </div>

        {/* 表单 */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="min-h-[260px]">{renderStepContent()}</div>

            {/* 导航按钮 */}
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

        {/* 底部链接 */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          {ta('hasAccount')}
          <Link href="/login" className="text-primary font-medium hover:underline ml-1">
            {ta('signIn')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
