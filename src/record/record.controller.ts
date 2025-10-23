import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RecordService } from './record.service';
import { CustomResponse } from 'src/infra/dto/custom-response.dto';
import { Response } from 'express';
import { CustomRequest } from 'src/infra/dto/custom-request.dto';
import { FetchRecordDto } from './dto/fetch-record.dto';

@ApiTags('Record Manager')
@Controller('record')
export class RecordController {
  constructor(private readonly recordService: RecordService) {}

  @Get()
  async findAll(@Req() req: CustomRequest, @Res() res: Response, @Query() queryParams: FetchRecordDto) {
    const users = await this.recordService.findRecords(req, queryParams);
    return CustomResponse(res, 200, 'Records successfully retrieved', users, req.pagination);
  }
}
