import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Env } from './common';
import { RecordModule } from './modules/record/record.module';
import { PaginateResponse } from './infra/middlewares';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';

@Module({
  imports: [
    MongooseModule.forRoot(Env.DB_URL),
    BullModule.forRoot({
      redis: {
        host: Env.REDIS_HOST || 'redis',
        port: parseInt(Env.REDIS_PORT || '6379', 10),
      },
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    RecordModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PaginateResponse).forRoutes('*');
  }
}
