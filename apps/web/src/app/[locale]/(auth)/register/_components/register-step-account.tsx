'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { Link } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { suggestEmailDomains } from '@/lib/email-suggestions';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PasswordStrength } from '@/components/ui/password-strength';
import { cn } from '@/lib/utils';
import { Gift, ChevronDown, Eye, EyeOff } from 'lucide-react';

interface RegisterStepAccountProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  watchedPassword: string;
  referralOpen: boolean;
  onReferralOpenChange: (open: boolean) => void;
}

export function RegisterStepAccount({
  form,
  watchedPassword,
  referralOpen,
  onReferralOpenChange,
}: RegisterStepAccountProps) {
  const t = useTranslations();
  const ta = useTranslations('auth.register');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [emailTaken, setEmailTaken] = useState(false);

  // On blur, ask the backend whether this email is already registered.
  // Degrades silently on any error — never blocks signup.
  const checkEmailTaken = async (value: string) => {
    setEmailSuggestions([]);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setEmailTaken(false);
      return;
    }
    try {
      const res = await apiClient.get<{ available: boolean }>(
        `/auth/check-email?email=${encodeURIComponent(value)}`
      );
      setEmailTaken(!res.available);
    } catch {
      setEmailTaken(false);
    }
  };

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{ta('email')}</FormLabel>
            <FormControl>
              <Input
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  if (emailTaken) setEmailTaken(false);
                  setEmailSuggestions(suggestEmailDomains(e.target.value));
                }}
                onBlur={(e) => {
                  field.onBlur();
                  void checkEmailTaken(e.target.value);
                }}
              />
            </FormControl>
            {emailSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {emailSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      form.setValue('email', s, { shouldValidate: true });
                      setEmailSuggestions([]);
                      void checkEmailTaken(s);
                    }}
                    className="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {emailTaken && (
              <p className="pt-1 text-sm text-destructive">
                {ta('emailTaken')}{' '}
                <Link href="/login" className="font-medium underline underline-offset-2">
                  {ta('signIn')}
                </Link>
              </p>
            )}
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
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('validation.passwordMin')}
                  autoComplete="new-password"
                  className="pr-10"
                  {...field}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? ta('hidePassword') : ta('showPassword')}
                  className="absolute bottom-0 right-0 top-0 flex min-h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormControl>
            <FormMessage />
            <PasswordStrength password={watchedPassword} />
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
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={ta('confirmPassword')}
                  autoComplete="new-password"
                  className="pr-10"
                  {...field}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? ta('hidePassword') : ta('showPassword')}
                  className="absolute bottom-0 right-0 top-0 flex min-h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
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

      {/* Referral Code (collapsible) */}
      <Collapsible open={referralOpen} onOpenChange={onReferralOpenChange}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-h-10 items-center gap-2 pt-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Gift className="h-4 w-4" />
            <span>{t('referral.yourCode', { defaultValue: 'Have a referral code?' })}</span>
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', referralOpen && 'rotate-180')}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <FormField
            control={form.control}
            name="referralCode"
            render={({ field }) => (
              <FormItem className="pt-2">
                <FormControl>
                  {/* @i18n-skip referral code format example */}
                  <Input
                    placeholder="A1B2C3D4"
                    className="font-mono uppercase tracking-wider"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
