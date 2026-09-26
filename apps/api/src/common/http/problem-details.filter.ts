import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ProblemType, type ProblemDetails } from '@maanslogen/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './app-error';

/**
 * Ét fejlformat for hele API'et (RFC 9457). Uden dette sender Nest tre forskellige
 * former afhængigt af hvor fejlen kom fra — og frontend ender med at gætte.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const problem = this.toProblem(exception);
    problem.instance = request.url;
    problem.requestId = request.id;

    if (problem.status >= 500) {
      this.logger.error(
        { err: exception, requestId: request.id, path: request.url },
        'Uventet fejl under håndtering af forespørgsel',
      );
    }

    void reply.status(problem.status).type('application/problem+json').send(problem);
  }

  private toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof AppError) {
      return { ...exception.problem };
    }

    if (exception instanceof ThrottlerException) {
      return {
        type: ProblemType.RateLimited,
        title: 'For mange forespørgsler',
        status: HttpStatus.TOO_MANY_REQUESTS,
        detail: 'Prøv igen om lidt.',
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail =
        typeof response === 'string'
          ? response
          : typeof response === 'object' && response !== null && 'message' in response
            ? Array.isArray(response.message)
              ? ((response as { message: string[] }).message ?? []).join(', ')
              : String(response.message)
            : exception.message;

      return {
        type: this.typeForStatus(status),
        title: this.titleForStatus(status),
        status,
        detail,
      };
    }

    return {
      type: ProblemType.Internal,
      title: 'Uventet serverfejl',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'Noget gik galt. Prøv igen — fejlen er logget.',
    };
  }

  private typeForStatus(status: number): string {
    const byStatus: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: ProblemType.ValidationFailed,
      [HttpStatus.UNAUTHORIZED]: ProblemType.Unauthorized,
      [HttpStatus.FORBIDDEN]: ProblemType.Forbidden,
      [HttpStatus.NOT_FOUND]: ProblemType.NotFound,
      [HttpStatus.CONFLICT]: ProblemType.Conflict,
      [HttpStatus.PAYLOAD_TOO_LARGE]: ProblemType.PayloadTooLarge,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ProblemType.ValidationFailed,
      [HttpStatus.TOO_MANY_REQUESTS]: ProblemType.RateLimited,
    };
    return byStatus[status] ?? ProblemType.Internal;
  }

  private titleForStatus(status: number): string {
    const titles: Record<number, string> = {
      400: 'Ugyldig forespørgsel',
      401: 'Ikke autentificeret',
      403: 'Ingen adgang',
      404: 'Ikke fundet',
      409: 'Konflikt',
      413: 'For stort indhold',
      422: 'Validering fejlede',
      429: 'For mange forespørgsler',
    };
    return titles[status] ?? 'Serverfejl';
  }
}
