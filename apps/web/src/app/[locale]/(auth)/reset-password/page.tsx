'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/lib/i18n/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { KeyRound, ArrowLeft, Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: { token: string; newPassword: string }) =>
      apiClient.post('/auth/reset-password', data, { skipAuth: true }),
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('无效的重置链接');
      return;
    }

    if (password.length < 8) {
      toast.error('密码至少8位');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      toast.error('密码必须包含字母和数字');
      return;
    }

    mutation.mutate({ token, newPassword: password });
  };

  // No token - invalid link
  if (!token) {
    return (
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">无效的链接</CardTitle>
          <CardDescription>重置密码链接无效或已过期</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/forgot-password">
            <Button>重新获取链接</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (success) {
    return (
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">密码重置成功</CardTitle>
          <CardDescription>您的密码已更新，请使用新密码登录</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button className="w-full">前往登录</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <KeyRound className="h-8 w-8 text-blue-600" />
        </div>
        <CardTitle className="text-2xl">设置新密码</CardTitle>
        <CardDescription>请输入您的新密码</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">新密码</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="至少8位，包含字母和数字"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={mutation.isPending}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          {/* Password requirements */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className={password.length >= 8 ? 'text-green-600' : ''}>
              {password.length >= 8 ? '✓' : '○'} 至少 8 位字符
            </p>
            <p className={/[A-Za-z]/.test(password) ? 'text-green-600' : ''}>
              {/[A-Za-z]/.test(password) ? '✓' : '○'} 包含字母
            </p>
            <p className={/\d/.test(password) ? 'text-green-600' : ''}>
              {/\d/.test(password) ? '✓' : '○'} 包含数字
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                重置中...
              </>
            ) : (
              '重置密码'
            )}
          </Button>

          <div className="text-center">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回登录
              </Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}




