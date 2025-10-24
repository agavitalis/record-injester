import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordService,  } from './record.service';
import { RecordController } from './record.controller';
import { InjesterEngineCore } from '../infra/core/injester-engine.core';
import { JsonData, JsonDataSchema } from './entities/json-data.entity';
import { JsonCatalog, JsonCatalogSchema } from './entities/json-catalog.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: JsonCatalog.name, schema: JsonCatalogSchema },
      { name: JsonData.name, schema: JsonDataSchema },
    ]), 
    HttpModule
  ],
  exports: [RecordService, InjesterEngineCore],
  controllers: [RecordController],
  providers: [RecordService, InjesterEngineCore],
})
export class RecordModule {}
