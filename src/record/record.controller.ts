import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { RecordService } from './record.service';
import { FetchRecordDto } from './dto/fetch-record.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomRequest } from 'src/infra/dto/custom-request.dto';
import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { CustomResponse } from 'src/infra/dto/custom-response.dto';

@ApiTags('Record Manager')
@Controller('record')
export class RecordController {
  constructor(private readonly recordService: RecordService) {}

  @Get()
  async findRecords(@Req() req: CustomRequest, @Res() res: Response, @Query() queryParams: FetchRecordDto) {
    const users = await this.recordService.findRecords(req, queryParams);
    return CustomResponse(res, 200, 'Records successfully retrieved', users, req.pagination);
  }

   @Get('sources')
  async findSources(@Res() res: Response) {
    const sources = await this.recordService.findSources();
    return CustomResponse(res, 200, 'Sources successfully retrieved', sources, null);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'handleSyncRecords',
    timeZone: 'Europe/Dublin',
  })
  async handleSyncRecords() {
    await this.recordService.syncRecords();
  }

   @Get('/injest')
   async handleSyncingRecords() {
    await this.recordService.syncRecords();
  }
}
