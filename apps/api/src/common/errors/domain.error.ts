/**
 * Base class for all domain errors.
 *
 * Domain errors stay framework-free — they carry a plain HTTP status *number*
 * (no `@nestjs/common` import), which the `GlobalExceptionFilter` reads to build
 * the response envelope. Controllers therefore never translate domain errors to
 * `HttpException`s by hand.
 *
 * Each concrete error declares its own `httpStatus`, co-located with the error
 * definition, so "what status does this map to" is visible where the error lives.
 */
export abstract class DomainError extends Error {
  abstract readonly httpStatus: number;
}
