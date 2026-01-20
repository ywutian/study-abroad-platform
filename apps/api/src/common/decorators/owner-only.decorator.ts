import { SetMetadata } from '@nestjs/common';

export const OWNER_KEY = 'owner';

export interface OwnerMetadata {
  /** The Prisma model name to query (e.g. 'admissionCase', 'profile') */
  model: string;
  /** The route param name for the resource ID (default: 'id') */
  idParam?: string;
  /** The field name on the model that references the user (default: 'userId') */
  userField?: string;
}

/**
 * Decorator that enforces resource ownership.
 * The requesting user must own the resource (or be an ADMIN) to proceed.
 *
 * @example
 * @OwnerOnly({ model: 'admissionCase' })
 * @Put(':id')
 * update(@Param('id') id: string, ...) { ... }
 */
export const OwnerOnly = (metadata: OwnerMetadata) =>
  SetMetadata(OWNER_KEY, metadata);
