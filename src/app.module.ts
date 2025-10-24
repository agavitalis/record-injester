import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Env } from './common';
import { RecordModule } from './record/record.module';
import { PaginateResponse } from './infra/middlewares';

@Module({
  imports: [
    MongooseModule.forRoot(Env.DB_URL),
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
