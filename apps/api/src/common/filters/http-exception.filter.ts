import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string | string[];
    timestamp: string;
    path: string;
    correlationId?: string;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request as any).correlationId as string | undefined;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    // --- HttpException (NestJS built-in) ---
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string | string[]) || exception.message;
        code = (res.code as string) || this.getCodeFromStatus(status);
      } else {
        message = String(exceptionResponse);
        code = this.getCodeFromStatus(status);
      }

      // --- Prisma Known Request Errors ---
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaResult = this.handlePrismaError(exception);
      status = prismaResult.status;
      message = prismaResult.message;
      code = prismaResult.code;

      // --- Prisma Validation Errors ---
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = this.isProduction
        ? 'Invalid data provided'
        : exception.message.split('\n').pop()?.trim() || 'Validation error';

      // --- Prisma Initialization Errors ---
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = 'DATABASE_UNAVAILABLE';
      message = this.isProduction
        ? 'Service temporarily unavailable'
        : `Database initialization failed: ${exception.message}`;

      // --- Generic Error ---
    } else if (exception instanceof Error) {
      // In production, mask internal error details
      message = this.isProduction ? 'Internal server error' : exception.message;
    }

    // Log with full detail (never masked)
    this.logger.error(
      `[${correlationId || 'no-id'}] ${request.method} ${request.url} - ${status} - ${
        Array.isArray(message) ? message.join('; ') : message
      }`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    const body: ErrorResponseBody = {
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
        ...(correlationId && { correlationId }),
      },
    };

    response.status(status).json(body);
  }

  /**
   * Maps Prisma error codes to HTTP-friendly responses.
   * @see https://www.prisma.io/docs/orm/reference/error-reference
   */
  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
  } {
    switch (error.code) {
      // Unique constraint violation
      case 'P2002': {
        const target = (error.meta?.target as string[])?.join(', ') || 'field';
        return {
          status: HttpStatus.CONFLICT,
          code: 'DUPLICATE_ENTRY',
          message: this.isProduction
            ? 'A record with this value already exists'
            : `Unique constraint failed on: ${target}`,
        };
      }

      // Record not found
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'The requested record was not found',
        };

      // Foreign key constraint violation
      case 'P2003': {
        const field = (error.meta?.field_name as string) || 'related record';
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'FOREIGN_KEY_ERROR',
          message: this.isProduction
            ? 'Invalid reference to a related record'
            : `Foreign key constraint failed on: ${field}`,
        };
      }

      // Required field missing
      case 'P2011':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'REQUIRED_FIELD_MISSING',
          message: 'A required field is missing',
        };

      // Value too long
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'VALUE_TOO_LONG',
          message: 'The provided value is too long for this field',
        };

      // Connection error
      case 'P1001':
      case 'P1002':
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          code: 'DATABASE_UNAVAILABLE',
          message: 'Service temporarily unavailable',
        };

      // Query timeout
      case 'P2024':
        return {
          status: HttpStatus.GATEWAY_TIMEOUT,
          code: 'QUERY_TIMEOUT',
          message: 'The operation timed out',
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: this.isProduction
            ? 'An unexpected database error occurred'
            : `Prisma error ${error.code}: ${error.message}`,
        };
    }
  }

  private getCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'GATEWAY_TIMEOUT';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
