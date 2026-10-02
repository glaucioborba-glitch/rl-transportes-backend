import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { YardSnapshotService } from './yard-snapshot.service';

@Module({
  imports: [PrismaModule, RedisModule, RealtimeModule],
  providers: [YardSnapshotService],
  exports: [YardSnapshotService],
})
export class YardReadModule {}
