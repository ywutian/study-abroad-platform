import { SetMetadata } from '@nestjs/common';
import type { PermissionType } from '../constants/permissions';

export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (...permissions: PermissionType[]) =>
  SetMetadata(PERMISSION_KEY, permissions);
