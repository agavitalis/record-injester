import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordController } from './record.controller';
import { RecordService,  } from './record.service';
import { JsonData, JsonDataSchema } from './entities/json-data.entity';
import { JsonCatalog, JsonCatalogSchema } from './entities/json-catalog.entity';

@Module({
  imports: [MongooseModule.forFeature([
    { name: JsonCatalog.name, schema: JsonCatalogSchema },
    { name: JsonData.name, schema: JsonDataSchema },
  ]), HttpModule],
  exports: [RecordService],
  controllers: [RecordController],
  providers: [RecordService],
})
export class RecordModule {}
