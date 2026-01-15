import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // CORS configuration - restrict origins in production via CORS_ORIGINS env var
  const corsOrigins = process.env.CORS_ORIGINS;
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()) : true,
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

  // Request body size limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security Headers (Helmet)
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
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
    } catch (error) {
      logger.warn(
        `⚠️ Swagger UI failed to initialize: ${error.message}. API will continue without interactive docs.`,
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
    gracefulShutdown('uncaughtException');
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: http://0.0.0.0:${port}`);
  if (!isProduction) {
    logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
  logger.log(`Health check: http://localhost:${port}/health`);
}

bootstrap();
