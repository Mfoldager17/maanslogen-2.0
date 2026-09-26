import { Inject, Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import type {
  AuthSession,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  User as UserDto,
} from '@maanslogen/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/app-error';
import { CONFIG, type AppConfig } from '../../config/env';
import { TokenService } from './token.service';
import { toUserDto } from '../users/user.mapper';

export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

/**
 * argon2id med bevidst satte parametre — hurtigt nok til et login,
 * dyrt nok til at en lækket database ikke er en ordbogsliste.
 */
const ARGON_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async register(input: RegisterInput, context: RequestContext = {}): Promise<AuthSession> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw AppError.conflict('Der findes allerede en bruger med den e-mail', {
        email: ['E-mailen er optaget'],
      });
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash: await argon2.hash(input.password, ARGON_OPTIONS),
      },
      include: { avatar: { include: { renditions: true } } },
    });

    return this.createSession(user, context);
  }

  async login(input: LoginInput, context: RequestContext = {}): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { avatar: { include: { renditions: true } } },
    });

    // Verificér altid mod en hash, også når brugeren ikke findes, så svartiden
    // ikke afslører hvilke e-mails der er oprettet.
    const hash = user?.passwordHash ?? (await this.dummyHash());
    const valid = await argon2.verify(hash, input.password).catch(() => false);

    if (!user || !valid || user.deletedAt) {
      throw AppError.unauthorized('Forkert e-mail eller adgangskode');
    }
    if (!user.active) {
      throw AppError.forbidden('Kontoen er deaktiveret');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.createSession(user, context);
  }

  /**
   * Rullende refresh: hvert token kan bruges én gang. Bruges det igen,
   * er det lækket, og hele familien invalideres.
   */
  async refresh(token: string, context: RequestContext = {}): Promise<AuthSession> {
    const stored = await this.tokens.findRefreshToken(token);
    if (!stored) throw AppError.unauthorized('Ugyldigt refresh-token');

    if (stored.rotatedAt || stored.revokedAt) {
      this.logger.warn(
        { userId: stored.userId, familyId: stored.familyId },
        'Genbrug af refresh-token opdaget — hele familien invalideres',
      );
      await this.tokens.revokeFamily(stored.familyId);
      throw AppError.unauthorized('Refresh-tokenet er allerede brugt — log ind igen');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw AppError.unauthorized('Refresh-tokenet er udløbet');
    }
    if (!stored.user.active || stored.user.deletedAt) {
      await this.tokens.revokeAllForUser(stored.userId);
      throw AppError.forbidden('Kontoen er deaktiveret');
    }

    await this.tokens.markRotated(stored.id);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: stored.userId },
      include: { avatar: { include: { renditions: true } } },
    });

    return this.createSession(user, { ...context, familyId: stored.familyId });
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    const stored = await this.tokens.findRefreshToken(token);
    if (stored) await this.tokens.revokeFamily(stored.familyId);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('Bruger', userId);

    const valid = await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false);
    if (!valid) {
      throw AppError.validation('Den nuværende adgangskode er forkert', {
        currentPassword: ['Forkert adgangskode'],
      });
    }

    // tokenVersion bumpes, så alle udstedte access-tokens bliver ugyldige.
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await argon2.hash(input.newPassword, ARGON_OPTIONS),
        tokenVersion: { increment: 1 },
      },
    });
    await this.tokens.revokeAllForUser(userId);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { avatar: { include: { renditions: true } }, _count: { select: { reviews: true } } },
    });
    if (!user || user.deletedAt) throw AppError.notFound('Bruger', userId);
    return toUserDto(user);
  }

  private async createSession(
    user: Parameters<typeof toUserDto>[0] & { tokenVersion: number },
    context: RequestContext & { familyId?: string },
  ): Promise<AuthSession> {
    const accessToken = await this.tokens.signAccessToken(user);
    const refresh = await this.tokens.issueRefreshToken(user.id, context);

    return {
      user: toUserDto(user),
      tokens: {
        accessToken,
        refreshToken: refresh.token,
        tokenType: 'Bearer',
        expiresIn: this.tokens.accessTokenTtlSeconds,
      },
    };
  }

  private dummyHashCache: string | null = null;

  private async dummyHash(): Promise<string> {
    this.dummyHashCache ??= await argon2.hash('ingen-bruger-med-den-email', ARGON_OPTIONS);
    return this.dummyHashCache;
  }

  /** Bruges af cron-jobbet i AuthModule. */
  async purgeExpiredTokens(): Promise<number> {
    return this.tokens.deleteExpired();
  }

  get cookieOptions(): {
    httpOnly: true;
    secure: boolean;
    sameSite: 'lax' | 'none';
    path: string;
    domain?: string;
    maxAge: number;
  } {
    const isProduction = this.config.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      domain: this.config.COOKIE_DOMAIN,
      maxAge: this.tokens.refreshTokenTtlSeconds,
    };
  }
}
