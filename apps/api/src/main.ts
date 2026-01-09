import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // CORS must be enabled at app creation time to handle preflight requests
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
  ];

  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production' 
      ? ['error', 'warn', 'log'] 
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Configure CORS - must be done after app creation but before routes
  app.enableCors({
    origin: (requestOrigin: string | undefined, callback: (err: Error | null, origin?: string | boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!requestOrigin) {
        callback(null, true);
        return;
      }
      // Check if the origin is in our allowed list
      if (allowedOrigins.indexOf(requestOrigin) !== -1) {
        callback(null, requestOrigin);
      } else {
        // In development, allow all origins for debugging
        if (process.env.NODE_ENV !== 'production') {
          callback(null, requestOrigin);
        } else {
          callback(null, false);
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // API versioning
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/live', 'health/ready', 'health/startup', 'health/detailed'],
  });

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

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
    })
  );

  // Swagger setup - 仅在非生产环境启用
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Study Abroad Platform API')
      .setDescription('API for the Study Abroad Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  }
  logger.log(`💚 Health check: http://localhost:${port}/health`);
}

bootstrap();
