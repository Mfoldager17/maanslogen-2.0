import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  authSessionSchema,
  changePasswordSchema,
  loginSchema,
  registerSchema,
  userSchema,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
} from '@maanslogen/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodBody } from '../../common/http/zod.pipe';
import { ApiProblemResponses, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi';
import { AppError } from '../../common/http/app-error';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Opret en konto og log ind med det samme' })
  @ApiZodBody(registerSchema)
  @ApiZodResponse(HttpStatus.CREATED, authSessionSchema, 'Kontoen er oprettet')
  @ApiProblemResponses(409, 422)
  async register(
    @ZodBody(registerSchema) body: RegisterInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.auth.register(body, this.contextOf(request));
    return this.withCookies(session, reply);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log ind' })
  @ApiZodBody(loginSchema)
  @ApiZodResponse(HttpStatus.OK, authSessionSchema, 'Logget ind')
  @ApiProblemResponses(401, 403, 422)
  async login(
    @ZodBody(loginSchema) body: LoginInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.auth.login(body, this.contextOf(request));
    return this.withCookies(session, reply);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Byt et refresh-token til et nyt sæt tokens' })
  @ApiZodResponse(HttpStatus.OK, authSessionSchema, 'Nye tokens udstedt')
  @ApiProblemResponses(401, 403)
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body() body?: { refreshToken?: string },
  ) {
    const token = this.refreshTokenOf(request, body);
    if (!token) throw AppError.unauthorized('Intet refresh-token');
    const session = await this.auth.refresh(token, this.contextOf(request));
    return this.withCookies(session, reply);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Log ud og invalidér refresh-familien' })
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body() body?: { refreshToken?: string },
  ): Promise<void> {
    await this.auth.logout(this.refreshTokenOf(request, body));
    void reply.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    void reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  }

  @Get('me')
  @ApiOperation({ summary: 'Den indloggede bruger' })
  @ApiZodResponse(HttpStatus.OK, userSchema, 'Brugerens profil')
  @ApiProblemResponses(401)
  async me(@CurrentUser('sub') userId: string) {
    return this.auth.me(userId);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Skift adgangskode — invaliderer alle sessioner' })
  @ApiZodBody(changePasswordSchema)
  @ApiProblemResponses(401, 422)
  async changePassword(
    @CurrentUser('sub') userId: string,
    @ZodBody(changePasswordSchema) body: ChangePasswordInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.auth.changePassword(userId, body);
    void reply.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    void reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  }

  private contextOf(request: FastifyRequest) {
    return {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    };
  }

  private refreshTokenOf(
    request: FastifyRequest,
    body?: { refreshToken?: string },
  ): string | undefined {
    const cookies = (request as unknown as { cookies?: Record<string, string> }).cookies;
    return body?.refreshToken ?? cookies?.[REFRESH_TOKEN_COOKIE];
  }

  /**
   * Browsere får tokens som httpOnly-cookies (ikke læsbare fra JavaScript).
   * Andre klienter kan bruge `tokens` i svaret direkte.
   */
  private withCookies(
    session: Awaited<ReturnType<AuthService['login']>>,
    reply: FastifyReply,
  ): Awaited<ReturnType<AuthService['login']>> {
    const options = this.auth.cookieOptions;
    if (session.tokens.refreshToken) {
      void reply.setCookie(REFRESH_TOKEN_COOKIE, session.tokens.refreshToken, options);
    }
    void reply.setCookie(ACCESS_TOKEN_COOKIE, session.tokens.accessToken, {
      ...options,
      maxAge: session.tokens.expiresIn,
    });
    return session;
  }
}
