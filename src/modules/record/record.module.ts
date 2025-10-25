import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordService } from './record.service';
import { RecordController } from './record.controller';
import { InjesterEngineCore } from '../../infra/core/injester-engine.core';
import { JsonData, JsonDataSchema } from './entities/json-data.entity';
import { JsonCatalog, JsonCatalogSchema } from './entities/json-catalog.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { RecordProcessor } from './record-processor';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: JsonCatalog.name, schema: JsonCatalogSchema },
      { name: JsonData.name, schema: JsonDataSchema },
    ]),
    HttpModule,
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: 'record-queue',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 10,
        attempts: 3,
      },
    }),
    BullBoardModule.forFeature({
      name: 'record-queue',
      adapter: BullAdapter,
    }),
  ],
  exports: [RecordService, InjesterEngineCore],
  controllers: [RecordController],
  providers: [RecordProcessor,RecordService, InjesterEngineCore, BullModule],
})
export class RecordModule {}
