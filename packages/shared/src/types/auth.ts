// User & Auth

export enum Role {
  USER = 'USER',
  VERIFIED = 'VERIFIED',
  // COUNSELOR is the B2B sibling of OPERATOR — both are elevated
  // non-admin roles. Granted to verified counselors so they can access
  // the `/counselor/*` workbench surfaces.
  COUNSELOR = 'COUNSELOR',
  OPERATOR = 'OPERATOR',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum Visibility {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
  ANONYMOUS = 'ANONYMOUS',
  VERIFIED_ONLY = 'VERIFIED_ONLY',
}

export interface User {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  error?: string;
}
