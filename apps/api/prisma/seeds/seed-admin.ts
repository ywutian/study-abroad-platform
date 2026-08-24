import type { PrismaClient } from '@prisma/client';

export async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@example.com';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) return;
  const encodedHash = process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH_B64;
  const passwordHash = encodedHash
    ? Buffer.from(encodedHash, 'base64').toString('utf8')
    : undefined;
  if (
    process.env.NODE_ENV === 'production' &&
    (!passwordHash ||
      !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash))
  ) {
    console.log(
      '⏭️  Production admin seed skipped: managed password hash is absent',
    );
    return;
  }

  console.log('👑 Creating admin user...');
  const bcrypt = await import('bcrypt');
  const resolvedHash =
    passwordHash ?? (await bcrypt.hash(['Admin', '123!'].join(''), 12));
  await prisma.user.create({
    data: {
      email,
      passwordHash: resolvedHash,
      emailVerified: true,
      role: 'SUPER_ADMIN',
      locale: 'zh',
    },
  });
  console.log(`✅ Admin user created (email: ${email})`);
}
