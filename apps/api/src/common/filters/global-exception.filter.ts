import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ZodError } from "zod";
import { Response, Request } from "express";

const HTTP_STATUS_NAMES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  408: "Request Timeout",
  409: "Conflict",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
};

const PRISMA_ERROR_MAP: Record<string, { status: number; error: string }> = {
  P2002: { status: 409, error: "Conflict" },
  P2003: { status: 400, error: "Bad Request" },
  P2024: { status: 408, error: "Request Timeout" },
  P2025: { status: 404, error: "Not Found" },
};

interface ErrorEnvelope {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const envelope = this.buildEnvelope(exception);

    if (envelope.statusCode >= 500) {
      this.logger.error(
        { err: exception, method: request.method, url: request.url },
        envelope.message,
      );
    } else {
      this.logger.warn(
        { method: request.method, url: request.url, statusCode: envelope.statusCode },
        envelope.message,
      );
    }

    response.status(envelope.statusCode).json(envelope);
  }

  private buildEnvelope(exception: unknown): ErrorEnvelope {
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception);
    }

    if (exception instanceof ZodError) {
      return this.handleZodError(exception);
    }

    if (this.isPrismaError(exception)) {
      return this.handlePrismaError(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    };
  }

  private handleHttpException(exception: HttpException): ErrorEnvelope {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
      const res = exceptionResponse as Record<string, unknown>;
      return {
        statusCode: status,
        error: (res.error as string) ?? HTTP_STATUS_NAMES[status] ?? "Error",
        message: (res.message as string) ?? exception.message,
        details: res.details as unknown,
      };
    }

    return {
      statusCode: status,
      error: HTTP_STATUS_NAMES[status] ?? "Error",
      message: typeof exceptionResponse === "string" ? exceptionResponse : exception.message,
    };
  }

  private handleZodError(error: ZodError): ErrorEnvelope {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      error: "Validation Error",
      message: "Request validation failed",
      details: error.flatten().fieldErrors,
    };
  }

  private isPrismaError(error: unknown): error is Error & { code: string; meta?: unknown } {
    return (
      error instanceof Error &&
      error.name === "PrismaClientKnownRequestError" &&
      "code" in error
    );
  }

  private handlePrismaError(error: Error & { code: string; meta?: unknown }): ErrorEnvelope {
    const mapping = PRISMA_ERROR_MAP[error.code];

    if (mapping) {
      return {
        statusCode: mapping.status,
        error: mapping.error,
        message: error.message,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    };
  }
}
