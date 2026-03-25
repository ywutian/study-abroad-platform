'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { API_ROUTES } from '@study-abroad/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { RoleBadge } from '../../_components/role-badge';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  UserCheck,
  AlertCircle,
  Loader2,
  Link2,
  Copy,
  Check,
  Clock,
} from 'lucide-react';

interface SearchResult {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

interface Invite {
  id: string;
  token: string;
  email?: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

interface InviteCreateResult {
  id: string;
  token: string;
  email?: string;
  role: string;
  expiresAt: string;
}

const ROLE_LEVEL: Record<string, number> = {
  USER: 0,
  VERIFIED: 1,
  OPERATOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function InvitesTab() {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<string>('search');

  // Search & promote state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('OPERATOR');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState('');

  // Invite link state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('OPERATOR');
  const [generatedLink, setGeneratedLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  // Invite history
  const { data: invites } = useQuery({
    queryKey: ['adminInvites'],
    queryFn: () => apiClient.get<Invite[]>('/admin/roles/invites'),
  });

  // ── Search & Promote mutations ──
  const searchMutation = useMutation({
    mutationFn: (searchEmail: string) =>
      apiClient.get<SearchResult>(
        `/admin/roles/users/search?email=${encodeURIComponent(searchEmail)}`
      ),
    onSuccess: (data) => {
      setSearchResult(data);
      setSearchError('');
    },
    onError: () => {
      setSearchResult(null);
      setSearchError(t('team.invites.userNotFound'));
    },
    meta: { skipGlobalErrorToast: true },
  });

  const promoteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      apiClient.post(`${API_ROUTES.ADMIN}/roles/users/promote`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOperators'] });
      toast.success(t('team.invites.promoted'));
      handleClose();
    },
  });

  // ── Invite link mutation ──
  const createInviteMutation = useMutation({
    mutationFn: (data: { email?: string; role: string }) =>
      apiClient.post<InviteCreateResult>('/admin/roles/operators/invite', data),
    onSuccess: (data) => {
      const baseUrl = window.location.origin;
      const locale = window.location.pathname.split('/')[1] || 'zh';
      setGeneratedLink(`${baseUrl}/${locale}/register/invite?token=${data.token}`);
      queryClient.invalidateQueries({ queryKey: ['adminInvites'] });
    },
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEmail('');
    setRole('OPERATOR');
    setSearchResult(null);
    setSearchError('');
    setInviteEmail('');
    setInviteRole('OPERATOR');
    setGeneratedLink('');
    setLinkCopied(false);
    setDialogTab('search');
  };

  const handleSearch = () => {
    if (!email.trim()) return;
    searchMutation.mutate(email.trim());
  };

  const handlePromote = () => {
    if (!searchResult) return;
    promoteMutation.mutate({ email: searchResult.email, role });
  };

  const handleGenerateLink = () => {
    createInviteMutation.mutate({
      email: inviteEmail.trim() || undefined,
      role: inviteRole,
    });
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setLinkCopied(true);
    toast.success(t('team.invites.linkCopied'));
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const isSameRole = searchResult?.role === role;
  const targetLevel = ROLE_LEVEL[role] ?? 0;
  const currentLevel = ROLE_LEVEL[searchResult?.role ?? 'USER'] ?? 0;
  const isDowngrade = targetLevel < currentLevel;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">{t('team.invites.pending')}</Badge>;
      case 'ACCEPTED':
        return <Badge variant="success">{t('team.invites.accepted')}</Badge>;
      case 'EXPIRED':
        return <Badge variant="secondary">{t('team.invites.expired')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('team.invites.create')}
        </Button>
      </div>

      {/* Invite History */}
      {invites && invites.length > 0 ? (
        <Card>
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-medium">{t('team.invites.history')}</h3>
          </div>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('team.invites.email')}</TableHead>
                  <TableHead>{t('team.invites.role')}</TableHead>
                  <TableHead>{t('team.invites.status')}</TableHead>
                  <TableHead>{t('team.invites.sentDate')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="text-sm">{invite.email || '—'}</TableCell>
                    <TableCell>
                      <RoleBadge role={invite.role} />
                    </TableCell>
                    <TableCell>{getStatusBadge(invite.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmt.dateTime(new Date(invite.createdAt), 'medium')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      ) : (
        <EmptyState
          type="first-time"
          title={t('team.invites.empty')}
          description={t('team.invites.emptyDesc')}
          action={{
            label: t('team.invites.create'),
            onClick: () => setDialogOpen(true),
          }}
        />
      )}

      {/* ── Add Member Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('team.invites.createTitle')}</DialogTitle>
          </DialogHeader>

          <Tabs
            value={dialogTab}
            onValueChange={(v) => {
              setDialogTab(v);
              setGeneratedLink('');
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="search" className="flex-1 gap-1.5">
                <Search className="h-3.5 w-3.5" />
                {t('team.invites.tabSearch')}
              </TabsTrigger>
              <TabsTrigger value="invite" className="flex-1 gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                {t('team.invites.tabInvite')}
              </TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Search & Promote ── */}
            <TabsContent value="search" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{t('team.invites.emailLabel')}</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder={t('team.invites.searchPlaceholder')}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setSearchResult(null);
                      setSearchError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button
                    variant="outline"
                    onClick={handleSearch}
                    disabled={!email.trim() || searchMutation.isPending}
                    className="shrink-0 gap-2"
                  >
                    {searchMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {t('team.invites.searchButton')}
                  </Button>
                </div>
              </div>

              {searchError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {searchError}
                </div>
              )}

              {searchResult && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-success">
                    <UserCheck className="h-4 w-4" />
                    {t('team.invites.userFound')}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('team.invites.emailLabel')}</span>
                      <p className="font-medium">{searchResult.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('team.invites.currentRole')}</span>
                      <div className="mt-0.5">
                        <RoleBadge role={searchResult.role} />
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('team.invites.joinedAt')}</span>
                      <p className="font-medium">
                        {fmt.dateTime(new Date(searchResult.createdAt), 'medium')}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t">
                    <Label>{t('team.invites.targetRole')}</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPERATOR">{t('roles.operator')}</SelectItem>
                        {isSuperAdmin && <SelectItem value="ADMIN">{t('roles.admin')}</SelectItem>}
                      </SelectContent>
                    </Select>
                    {isSameRole && (
                      <p className="text-xs text-warning">{t('team.invites.sameRole')}</p>
                    )}
                  </div>
                </Card>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handlePromote}
                  disabled={!searchResult || isSameRole || isDowngrade || promoteMutation.isPending}
                  className="gap-2"
                >
                  {promoteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('team.invites.promote')}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* ── Tab 2: Generate Invite Link ── */}
            <TabsContent value="invite" className="space-y-4 mt-4">
              {!generatedLink ? (
                <>
                  <div className="space-y-2">
                    <Label>{t('team.invites.emailOptional')}</Label>
                    <Input
                      type="email"
                      placeholder="operator@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('team.invites.roleLabel')}</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPERATOR">{t('roles.operator')}</SelectItem>
                        {isSuperAdmin && <SelectItem value="ADMIN">{t('roles.admin')}</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      onClick={handleGenerateLink}
                      disabled={createInviteMutation.isPending}
                      className="gap-2"
                    >
                      {createInviteMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      <Link2 className="h-4 w-4" />
                      {t('team.invites.generateLink')}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>{t('team.invites.inviteLink')}</Label>
                    <div className="flex gap-2">
                      <Input value={generatedLink} readOnly className="font-mono text-xs" />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyLink}
                        className="shrink-0"
                      >
                        {linkCopied ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {t('team.invites.linkExpiry')}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                      {t('common.cancel')}
                    </Button>
                    <Button onClick={handleCopyLink} className="gap-2">
                      {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {t('team.invites.copyLink')}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
