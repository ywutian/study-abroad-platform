'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/lib/i18n/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: (email: string) =>
      apiClient.post('/auth/forgot-password', { email }, { skipAuth: true }),
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('请输入邮箱地址');
      return;
    }
    mutation.mutate(email);
  };

  if (submitted) {
    return (
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">邮件已发送</CardTitle>
          <CardDescription>如果该邮箱已注册，您将收到重置密码的链接</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            请检查您的收件箱 <strong>{email}</strong>
          </p>
          <p className="text-sm text-muted-foreground">没有收到？请检查垃圾邮件文件夹</p>
          <div className="flex flex-col gap-2 pt-4">
            <Button variant="outline" onClick={() => setSubmitted(false)}>
              重新发送
            </Button>
            <Link href="/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回登录
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <Mail className="h-8 w-8 text-blue-600" />
        </div>
        <CardTitle className="text-2xl">忘记密码</CardTitle>
        <CardDescription>输入您的邮箱，我们将发送重置密码的链接</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱地址</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                发送中...
              </>
            ) : (
              '发送重置链接'
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




