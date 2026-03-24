'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { Eye, EyeOff, Copy, Edit, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { VaultItemDetail, CredentialData } from './vault-types';
import { isSafeUrl } from '@/lib/utils/url';
import { typeIcons, typeColors, typeBgColors } from './vault-constants';

interface VaultViewDialogProps {
  item: VaultItemDetail | null;
  onClose: () => void;
  onEdit: (item: VaultItemDetail) => void;
  onDelete: (itemId: string) => void;
}

function parseCredentialData(data: string): CredentialData {
  try {
    return JSON.parse(data);
  } catch {
    return { notes: data };
  }
}

export function VaultViewDialog({ item, onClose, onEdit, onDelete }: VaultViewDialogProps) {
  const t = useTranslations('vault');
  const format = useFormatter();
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    return format.dateTime(new Date(dateStr), 'medium');
  };

  return (
    <Dialog open={!!item} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg bg-card border-border text-foreground">
        {item && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-xl bg-gradient-to-br ${typeColors[item.type]} text-white`}
                >
                  {typeIcons[item.type]}
                </div>
                <div>
                  <DialogTitle className="text-xl">{item.title}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={typeBgColors[item.type]}>{t(item.type.toLowerCase())}</Badge>
                    {item.category && (
                      <Badge variant="outline" className="border-border text-muted-foreground">
                        {item.category}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {item.type === 'CREDENTIAL' ? (
                <>
                  {(() => {
                    const cred = parseCredentialData(item.data);
                    return (
                      <>
                        {cred.website && (
                          <div className="bg-muted rounded-lg p-3">
                            <label className="text-xs text-muted-foreground">{t('website')}</label>
                            <div className="flex items-center justify-between mt-1">
                              {isSafeUrl(cred.website) ? (
                                <a
                                  href={cred.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 dark:text-emerald-400 hover:underline"
                                >
                                  {cred.website}
                                </a>
                              ) : (
                                <span className="text-foreground">{cred.website}</span>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => copyToClipboard(cred.website!)}
                              >
                                {copied ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                        {cred.username && (
                          <div className="bg-muted rounded-lg p-3">
                            <label className="text-xs text-muted-foreground">{t('username')}</label>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-foreground font-mono">{cred.username}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => copyToClipboard(cred.username!)}
                              >
                                {copied ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                        {cred.password && (
                          <div className="bg-muted rounded-lg p-3">
                            <label className="text-xs text-muted-foreground">{t('password')}</label>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-foreground font-mono">
                                {showPassword
                                  ? cred.password
                                  : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(cred.password!)}
                                >
                                  {copied ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                        {cred.notes && (
                          <div className="bg-muted rounded-lg p-3">
                            <label className="text-xs text-muted-foreground">{t('notes')}</label>
                            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                              {cred.notes}
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-muted-foreground whitespace-pre-wrap">{item.data}</p>
                </div>
              )}

              {item.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="bg-muted text-muted-foreground">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                {t('updatedAt', { date: formatDate(item.updatedAt) })}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => onDelete(item.id)}
                  className="border-red-500/50 text-red-500 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('delete')}
                </Button>
                <Button onClick={() => onEdit(item)} className="bg-success">
                  <Edit className="h-4 w-4 mr-2" />
                  {t('edit')}
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
