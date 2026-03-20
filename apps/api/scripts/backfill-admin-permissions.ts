/**
 * Backfill script: Ensure ADMIN role has all permissions explicitly in RolePermission table.
 *
 * Required after PermissionGuard change: ADMIN no longer bypasses permission checks,
 * so all permissions must be explicitly granted in the database.
 *
 * Usage:
 *   pnpm exec ts-node --transpile-only scripts/backfill-admin-permissions.ts --dry-run
 *   pnpm exec ts-node --transpile-only scripts/backfill-admin-permissions.ts --apply
 */

import { PrismaClient, Role } from '@prisma/client';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/common/constants/permissions';

const prisma = new PrismaClient();
const isDryRun = !process.argv.includes('--apply');

async function main() {
  console.log(
    `\n=== Backfill Admin Permissions (${isDryRun ? 'DRY RUN' : 'APPLY'}) ===\n`,
  );

  for (const [roleName, permissions] of Object.entries(
    DEFAULT_ROLE_PERMISSIONS,
  )) {
    const role = roleName as Role;
    console.log(
      `\nProcessing role: ${role} (${permissions.length} permissions)`,
    );

    for (const permission of permissions) {
      const existing = await prisma.rolePermission.findUnique({
        where: { role_permission: { role, permission } },
      });

      if (existing) {
        if (!existing.granted) {
          console.log(`  [UPDATE] ${permission}: granted=false → true`);
          if (!isDryRun) {
            await prisma.rolePermission.update({
              where: { id: existing.id },
              data: { granted: true, grantedBy: 'backfill-script' },
            });
          }
        } else {
          console.log(`  [OK]     ${permission}: already granted`);
        }
      } else {
        console.log(`  [CREATE] ${permission}: new entry`);
        if (!isDryRun) {
          await prisma.rolePermission.create({
            data: {
              role,
              permission,
              granted: true,
              grantedBy: 'backfill-script',
            },
          });
        }
      }
    }
  }

  if (isDryRun) {
    console.log('\n⚠️  Dry run complete. Use --apply to make changes.\n');
  } else {
    console.log('\n✅ Backfill complete.\n');
  }
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
