import './tracing';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import { AppModule } from './app.module';

async function listenWithPortFallback(
  app: INestApplication,
  startPort: number,
  logger: Logger,
  maxAttempts = 10,
): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;
    try {
      await app.listen(port, '0.0.0.0');
      if (attempt > 0) {
        logger.warn(`Port ${startPort} is in use, using port ${port} instead`);
      }
      return port;
    } catch (err: any) {
      if (err.code === 'EADDRINUSE' && attempt < maxAttempts - 1) {
        logger.warn(`Port ${port} is in use, trying ${port + 1}...`);
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    `No available port found in range ${startPort}-${startPort + maxAttempts - 1}`,
  );
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Log level defaults: production=log, development=verbose
  const logLevelMap: Record<
    string,
    ('error' | 'warn' | 'log' | 'debug' | 'verbose')[]
  > = {
    error: ['error'],
    warn: ['error', 'warn'],
    log: ['error', 'warn', 'log'],
    debug: ['error', 'warn', 'log', 'debug'],
    verbose: ['error', 'warn', 'log', 'debug', 'verbose'],
  };
  const envLogLevel = process.env.LOG_LEVEL;
  const defaultLevel =
    process.env.NODE_ENV === 'production' ? 'log' : 'verbose';
  const logLevel =
    logLevelMap[envLogLevel || defaultLevel] || logLevelMap[defaultLevel];

  const app = await NestFactory.create(AppModule, { logger: logLevel });

  // Trust proxy headers from Cloud Load Balancer / reverse proxies
  // Ensures request.ip returns real client IP (critical for rate limiting)
  // 'uniquelocal' covers GCP internal network (fd00::/8, 10.0.0.0/8, etc.)
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

  // CORS configuration [A5-004]
  // Production REQUIRES CORS_ORIGINS to be set; development falls back to allow-all
  const corsOrigins = process.env.CORS_ORIGINS;
  const isProductionEnv = process.env.NODE_ENV === 'production';

  if (!corsOrigins && isProductionEnv) {
    throw new Error(
      'FATAL: CORS_ORIGINS must be set in production. ' +
        'Example: CORS_ORIGINS=https://app.example.com,https://admin.example.com',
    );
  }

  app.enableCors({
    origin: corsOrigins
      ? corsOrigins.split(',').map((o) => o.trim())
      : isProductionEnv
        ? false
        : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'X-Correlation-Id',
    ],
    exposedHeaders: [
      'X-Correlation-Id',
      'X-Response-Time',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
  });

  logger.log(
    corsOrigins
      ? `CORS restricted to: ${corsOrigins}`
      : 'CORS enabled for all origins (development mode)',
  );

  // API versioning
  app.setGlobalPrefix('api/v1', {
    exclude: [
      'health',
      'health/live',
      'health/ready',
      'health/startup',
      'health/detailed',
    ],
  });

  // Request body size limits — 普通 JSON 1MB，文件上传通过 multer 单独配置
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Security Headers (Helmet)
  const isProduction = process.env.NODE_ENV === 'production';

  // Build CSP connect-src: allow 'self' + CORS origins (https + wss for WebSocket)
  const cspConnectSrc: string[] = ["'self'"];
  if (corsOrigins) {
    const origins = corsOrigins.split(',').map((o) => o.trim());
    cspConnectSrc.push(...origins);
    cspConnectSrc.push(
      ...origins.map((o) => o.replace(/^https:\/\//, 'wss://')),
    );
  }

  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: cspConnectSrc,
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      // HSTS: Strict-Transport-Security
      hsts: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      // Prevent MIME type sniffing
      noSniff: true,
      // Prevent clickjacking
      frameguard: { action: 'deny' },
      // Referrer policy
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Disable powered-by header
      hidePoweredBy: true,
    }),
  );

  // Cookie Parser for httpOnly refresh tokens
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger setup (non-production only)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const config = new DocumentBuilder()
        .setTitle('Study Abroad Platform API')
        .setDescription(
          'RESTful API for the Study Abroad Platform — authentication, profiles, schools, AI agent, forum, and more.',
        )
        .setVersion('1.0.0')
        .addBearerAuth(
          { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          'JWT',
        )
        .addTag('auth', 'Authentication & authorization')
        .addTag('profiles', 'Student profiles & sub-resources')
        .addTag('schools', 'School database & search')
        .addTag('ai-agent', 'AI Agent chat & management')
        .addTag('forum', 'Community forum')
        .addTag('admin', 'Admin management')
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
          persistAuthorization: true,
          docExpansion: 'none',
          filter: true,
          tagsSorter: 'alpha',
          operationsSorter: 'method',
        },
      });
      logger.log('📚 Swagger UI enabled at /api/docs');
    } catch (error: unknown) {
      logger.warn(
        `⚠️ Swagger UI failed to initialize: ${error instanceof Error ? error.message : 'unknown error'}. API will continue without interactive docs.`,
      );
    }
  }

  // Graceful shutdown with timeout
  app.enableShutdownHooks();

  const SHUTDOWN_TIMEOUT_MS = 30_000; // 30 seconds
  let isShuttingDown = false;

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.log(`Received ${signal}. Starting graceful shutdown...`);

    // Force exit after timeout
    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref();

    try {
      await app.close();
      logger.log('Application shut down gracefully.');
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Catch unhandled rejections (should not happen, but safety net)
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    void gracefulShutdown('uncaughtException');
  });

  const desiredPort = Number(process.env.PORT) || 4101;
  const port = await listenWithPortFallback(app, desiredPort, logger);
  logger.log(`Application is running on: http://0.0.0.0:${port}`);
  if (!isProduction) {
    logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
  logger.log(`Health check: http://localhost:${port}/health`);
}

void bootstrap();
