import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AccessTokenClaims } from '@maanslogen/contracts';
import type { FastifyRequest } from 'fastify';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: AccessTokenClaims;
}

/** `@CurrentUser() user: AccessTokenClaims` — udfyldt af JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (field: keyof AccessTokenClaims | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
