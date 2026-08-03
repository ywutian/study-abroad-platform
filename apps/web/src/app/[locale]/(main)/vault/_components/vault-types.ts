import type {
  VaultItem as SharedVaultItem,
  VaultItemDetail as SharedVaultItemDetail,
  VaultStats as SharedVaultStats,
} from '@study-abroad/shared';

export type VaultItem = SharedVaultItem;
export type VaultItemDetail = SharedVaultItemDetail;
export type VaultStats = SharedVaultStats;
export type VaultItemType = SharedVaultItem['type'];

export interface CredentialData {
  username?: string;
  password?: string;
  website?: string;
  notes?: string;
}
