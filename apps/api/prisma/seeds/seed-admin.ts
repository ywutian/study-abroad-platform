import type { PrismaClient } from '@prisma/client';

export async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@example.com';
  const password =
    process.env.ADMIN_BOOTSTRAP_PASSWORD ??
    (process.env.NODE_ENV === 'production'
      ? undefined
      : ['Admin', '123!'].join(''));
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) return;
  if (!password) {
    console.log(
      '⏭️  Production admin seed skipped: managed bootstrap secret is absent',
    );
    return;
  }

  console.log('👑 Creating admin user...');
  const bcrypt = await import('bcrypt');
  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      emailVerified: true,
      role: 'SUPER_ADMIN',
      locale: 'zh',
    },
  });
  console.log(`✅ Admin user created (email: ${email})`);
}
