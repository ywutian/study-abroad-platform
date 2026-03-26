export interface FeatureFlag {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  rules: {
    roles?: string[];
    userIds?: string[];
    percentage?: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}
