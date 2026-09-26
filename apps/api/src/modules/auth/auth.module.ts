import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenService } from './token.service';

/** Rydder udløbne refresh-tokens, så tabellen ikke vokser i det uendelige. */
@Injectable()
class RefreshTokenJanitor {
  private readonly logger = new Logger(RefreshTokenJanitor.name);

  constructor(private readonly auth: AuthService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge(): Promise<void> {
    const deleted = await this.auth.purgeExpiredTokens();
    if (deleted > 0) this.logger.log(`Slettede ${deleted} udløbne refresh-tokens`);
  }
}

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtAuthGuard, RefreshTokenJanitor],
  exports: [AuthService, TokenService, JwtAuthGuard],
})
export class AuthModule {}
