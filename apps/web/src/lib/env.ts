import { z } from 'zod';

/**
 * Web 前端环境变量 Zod 验证
 *
 * 与 API 端 env.validation.ts 保持一致的验证策略：
 * - 必需变量缺失时在构建阶段快速失败
 * - 可选变量提供合理默认值
 * - 所有 NEXT_PUBLIC_* 变量在此统一管理
 */
const envSchema = z.object({
  /** API 服务地址（通过 Next.js rewrites 代理，通常为空即可） */
  NEXT_PUBLIC_API_URL: z.string().optional().default(''),
  /** 应用公开 URL（用于 SEO sitemap、robots.txt） */
  NEXT_PUBLIC_APP_URL: z.string().optional().default('https://www.lumniedu.com'),
  /** WebSocket 服务地址（默认与 API 地址一致） */
  NEXT_PUBLIC_WS_URL: z.string().optional(),
  /** Sentry DSN（可选，生产环境建议配置） */
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  /** 运行环境 */
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!result.success) {
    console.error('[env] Environment validation failed:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error('Invalid environment variables. See errors above.');
  }

  return result.data;
}

export const env = validateEnv();
