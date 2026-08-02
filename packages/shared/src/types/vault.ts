import type { VaultItemType } from '../constants/enums';

export interface VaultItem {
  id: string;
  type: VaultItemType;
  title: string;
  category?: string | null;
  tags: string[];
  icon?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaultItemDetail extends VaultItem {
  data: string;
}

export interface VaultStats {
  totalItems: number;
  credentialCount: number;
  documentCount: number;
  noteCount: number;
  certificateCount: number;
  categories: string[];
}

export interface CreateVaultItemInput {
  type: VaultItemType;
  title: string;
  data: string;
  category?: string;
  tags?: string[];
  icon?: string;
}

export type UpdateVaultItemInput = Partial<Omit<CreateVaultItemInput, 'type'>>;
