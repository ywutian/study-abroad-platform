'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

type VerifyState = 'loading' | 'success' | 'error';

export default function VerifyEmailCallbackPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMessage('无效的验证链接');
      return;
    }

    const verifyEmail = async () => {
      try {
        await apiClient.get(`/auth/verify-email?token=${token}`, { skipAuth: true });
        setState('success');
      } catch (error: any) {
        setState('error');
        setErrorMessage(error.message || '验证失败，请重试');
      }
    };

    verifyEmail();
  }, [token]);

  if (state === 'loading') {
    return (
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
          <CardTitle className="text-2xl">验证中...</CardTitle>
          <CardDescription>正在验证您的邮箱地址</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (state === 'error') {
    return (
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">验证失败</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            验证链接可能已过期或无效
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/login">
              <Button className="w-full">前往登录</Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" className="w-full">重新注册</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="text-center">
      <CardHeader>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <CardTitle className="text-2xl">验证成功！</CardTitle>
        <CardDescription>您的邮箱已成功验证</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          现在您可以登录并开始使用留学申请平台的所有功能
        </p>
        <Link href="/login">
          <Button className="w-full">前往登录</Button>
        </Link>
      </CardContent>
    </Card>
  );
}




