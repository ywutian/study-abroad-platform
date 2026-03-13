export type VaultItemType = 'CREDENTIAL' | 'DOCUMENT' | 'NOTE' | 'CERTIFICATE';

export interface VaultItem {
  id: string;
  type: VaultItemType;
  title: string;
  category?: string;
  tags: string[];
  icon?: string;
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

export interface CredentialData {
  username?: string;
  password?: string;
  website?: string;
  notes?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
