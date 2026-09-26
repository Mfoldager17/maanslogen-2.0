import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Drift')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  /** Liveness: svarer processen overhovedet? Bruges af container-orkestratoren. */
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness-probe' })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: kan vi rent faktisk betjene trafik? */
  @Public()
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness-probe — tjekker databasen' })
  ready() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.prisma.ping();
          return { database: { status: 'up' } };
        } catch (error) {
          return {
            database: { status: 'down', message: (error as Error).message },
          };
        }
      },
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }
}
