import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production' 
      ? ['error', 'warn', 'log'] 
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Simple CORS configuration - allow all origins for now
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  });
  
  logger.log('CORS enabled for all origins');

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
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Application is running on: http://0.0.0.0:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  }
  logger.log(`💚 Health check: http://localhost:${port}/health`);
}

bootstrap();
