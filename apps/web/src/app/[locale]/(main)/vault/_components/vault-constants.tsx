import { Braces, FileText, Key, LockKeyhole, Package, StickyNote } from 'lucide-react';
import { VaultItemType as VaultType } from '@study-abroad/shared';
import type { VaultItemType } from './vault-types';

export const typeIcons: Record<VaultItemType, React.ReactNode> = {
  PASSWORD: <LockKeyhole className="h-5 w-5" />,
  CREDENTIAL: <Key className="h-5 w-5" />,
  DOCUMENT: <FileText className="h-5 w-5" />,
  NOTE: <StickyNote className="h-5 w-5" />,
  API_KEY: <Braces className="h-5 w-5" />,
  OTHER: <Package className="h-5 w-5" />,
};

export const typeColors: Record<VaultItemType, string> = {
  PASSWORD: 'from-rose-500 to-pink-600',
  CREDENTIAL: 'from-amber-500 to-orange-600',
  DOCUMENT: 'from-blue-500 to-cyan-600',
  NOTE: 'from-emerald-500 to-green-600',
  API_KEY: 'from-violet-500 to-purple-600',
  OTHER: 'from-slate-500 to-slate-600',
};

export const typeBgColors: Record<VaultItemType, string> = {
  PASSWORD: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  CREDENTIAL: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  DOCUMENT: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  NOTE: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  API_KEY: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  OTHER: 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300',
};

export const VAULT_ITEM_TYPES: VaultItemType[] = Object.values(VaultType);
