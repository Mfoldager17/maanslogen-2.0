import { HttpException, HttpStatus } from '@nestjs/common';
import { ProblemType, type ProblemDetails } from '@maanslogen/contracts';

/**
 * Domænefejl med et RFC 9457-problem indbygget. Kastes fra services;
 * `ProblemDetailsFilter` skriver dem ud i det aftalte format.
 */
export class AppError extends HttpException {
  constructor(
    readonly problem: Omit<ProblemDetails, 'instance' | 'requestId'>,
    cause?: unknown,
  ) {
    super(problem, problem.status, { cause });
  }

  static notFound(resource: string, identifier?: string): AppError {
    return new AppError({
      type: ProblemType.NotFound,
      title: 'Ikke fundet',
      status: HttpStatus.NOT_FOUND,
      detail: identifier ? `${resource} med id "${identifier}" findes ikke` : `${resource} findes ikke`,
    });
  }

  static conflict(detail: string, errors?: Record<string, string[]>): AppError {
    return new AppError({
      type: ProblemType.Conflict,
      title: 'Konflikt',
      status: HttpStatus.CONFLICT,
      detail,
      errors,
    });
  }

  static validation(detail: string, errors?: Record<string, string[]>): AppError {
    return new AppError({
      type: ProblemType.ValidationFailed,
      title: 'Validering fejlede',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail,
      errors,
    });
  }

  static unauthorized(detail = 'Log ind for at fortsætte'): AppError {
    return new AppError({
      type: ProblemType.Unauthorized,
      title: 'Ikke autentificeret',
      status: HttpStatus.UNAUTHORIZED,
      detail,
    });
  }

  static forbidden(detail = 'Du har ikke adgang til denne handling'): AppError {
    return new AppError({
      type: ProblemType.Forbidden,
      title: 'Ingen adgang',
      status: HttpStatus.FORBIDDEN,
      detail,
    });
  }

  static badRequest(detail: string): AppError {
    return new AppError({
      type: ProblemType.ValidationFailed,
      title: 'Ugyldig forespørgsel',
      status: HttpStatus.BAD_REQUEST,
      detail,
    });
  }
}
