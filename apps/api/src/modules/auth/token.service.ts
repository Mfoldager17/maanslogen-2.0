import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AccessTokenClaims, Role } from '@maanslogen/contracts';
import { CONFIG, type AppConfig } from '../../config/env';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface IssuedRefreshToken {
  token: string;
  familyId: string;
  expiresAt: Date;
}

/** Sekunder ud fra "15m" / "30d". */
export function durationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error(`Ugyldig varighed: ${duration}`);
  const amount = Number(match[1]);
  const unit = match[2];
  const factors: Record<string, number> = { s: 1, m: 60, h: 3_600, d: 86_400 };
  return amount * (factors[unit as string] ?? 1);
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  get accessTokenTtlSeconds(): number {
    return durationToSeconds(this.config.ACCESS_TOKEN_TTL);
  }

  get refreshTokenTtlSeconds(): number {
    return durationToSeconds(this.config.REFRESH_TOKEN_TTL);
  }

  async signAccessToken(user: {
    id: string;
    email: string;
    role: Role;
    tokenVersion: number;
  }): Promise<string> {
    const claims: AccessTokenClaims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ver: user.tokenVersion,
    };
    return this.jwt.signAsync(claims, {
      secret: this.config.JWT_ACCESS_SECRET,
      expiresIn: this.accessTokenTtlSeconds,
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    return this.jwt.verifyAsync<AccessTokenClaims>(token, {
      secret: this.config.JWT_ACCESS_SECRET,
    });
  }

  /**
   * Refresh-tokens er tilfældige strenge, ikke JWT'er, og kun deres SHA-256-hash
   * gemmes. Lækker databasen, kan ingen af dem bruges.
   */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issueRefreshToken(
    userId: string,
    context: { familyId?: string; userAgent?: string; ipAddress?: string } = {},
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('base64url');
    const familyId = context.familyId ?? randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlSeconds * 1_000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(token),
        familyId,
        expiresAt,
        userAgent: context.userAgent?.slice(0, 500),
        ipAddress: context.ipAddress?.slice(0, 64),
      },
    });

    return { token, familyId, expiresAt };
  }

  async findRefreshToken(token: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: true },
    });
  }

  async markRotated(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { rotatedAt: new Date() },
    });
  }

  /**
   * Et allerede brugt refresh-token der dukker op igen betyder tyveri.
   * Hele familien dræbes, så både tyv og offer skal logge ind igen.
   */
  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
