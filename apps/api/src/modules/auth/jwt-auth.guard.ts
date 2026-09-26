import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ACCESS_TOKEN_COOKIE,
  roleAtLeast,
  type AccessTokenClaims,
  type Role,
} from '@maanslogen/contracts';
import { AppError } from '../../common/http/app-error';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from './token.service';

/**
 * Registreret globalt: alt kræver et gyldigt access-token, med mindre endpointet
 * er markeret `@Public()`. Rollekrav sættes med `@MinRole('MODERATOR')`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const controller = context.getClass();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      handler,
      controller,
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (isPublic) {
      // Offentlige endpoints må gerne kende brugeren (fx "din anmeldelse"),
      // men afviser ikke når tokenet mangler, er udløbet eller er tilbagekaldt.
      request.user = token ? ((await this.resolve(token)) ?? undefined) : undefined;
      return true;
    }

    if (!token) throw AppError.unauthorized();

    const claims = await this.resolve(token);
    if (!claims) throw AppError.unauthorized('Access-tokenet er ugyldigt eller udløbet');
    request.user = claims;

    const minRole = this.reflector.getAllAndOverride<Role | undefined>(ROLES_KEY, [
      handler,
      controller,
    ]);
    if (minRole && !roleAtLeast(claims.role, minRole)) {
      throw AppError.forbidden(`Handlingen kræver rollen ${minRole} eller højere`);
    }

    return true;
  }

  /**
   * Verificerer signaturen og tjekker tokenet mod brugeren i databasen.
   *
   * Et signeret JWT alene er ikke nok: rolleskift, deaktivering og
   * adgangskodeskift bumper brugerens `tokenVersion`, og uden dette opslag
   * ville allerede udstedte tokens blive ved med at virke indtil de udløb.
   * Prisen er ét primærnøgle-opslag pr. autentificeret forespørgsel.
   */
  private async resolve(token: string): Promise<AccessTokenClaims | null> {
    let claims: AccessTokenClaims;
    try {
      claims = await this.tokens.verifyAccessToken(token);
    } catch {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: { role: true, active: true, deletedAt: true, tokenVersion: true, email: true },
    });

    if (!user || !user.active || user.deletedAt) return null;
    if (user.tokenVersion !== claims.ver) return null;

    // Rollen læses fra databasen, ikke fra tokenet, så en degradering
    // slår igennem med det samme.
    return { ...claims, role: user.role, email: user.email };
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7).trim() || undefined;
    const cookies = (request as unknown as { cookies?: Record<string, string> }).cookies;
    return cookies?.[ACCESS_TOKEN_COOKIE];
  }
}
