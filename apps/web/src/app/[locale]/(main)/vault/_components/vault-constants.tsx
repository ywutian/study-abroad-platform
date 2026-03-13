import { Key, FileText, StickyNote, Award } from 'lucide-react';
import type { VaultItemType } from './vault-types';

export const typeIcons: Record<VaultItemType, React.ReactNode> = {
  CREDENTIAL: <Key className="h-5 w-5" />,
  DOCUMENT: <FileText className="h-5 w-5" />,
  NOTE: <StickyNote className="h-5 w-5" />,
  CERTIFICATE: <Award className="h-5 w-5" />,
};

export const typeColors: Record<VaultItemType, string> = {
  CREDENTIAL: 'from-amber-500 to-orange-600',
  DOCUMENT: 'from-blue-500 to-cyan-600',
  NOTE: 'from-emerald-500 to-green-600',
  CERTIFICATE: 'from-primary to-primary',
};

export const typeBgColors: Record<VaultItemType, string> = {
  CREDENTIAL: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  DOCUMENT: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  NOTE: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  CERTIFICATE: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
};

export const VAULT_ITEM_TYPES: VaultItemType[] = ['CREDENTIAL', 'DOCUMENT', 'NOTE', 'CERTIFICATE'];
