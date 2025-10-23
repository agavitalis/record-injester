import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { PaginationParamsSetup } from 'src/infra/dto/pagination-params.dto';
import { CustomRequest } from 'src/infra/dto/custom-request.dto';
import { FetchRecordDto } from './dto/fetch-record.dto';
import { BaseService } from 'src/infra/services/base.service';
import { JsonData, JsonDataDocument } from './entities/json-data.entity';

@Injectable()
export class RecordService extends BaseService<JsonData> {
  constructor(
    @InjectModel(JsonData.name)
    private readonly userModel: Model<JsonDataDocument>,
  ) {
    super(userModel as any);
  }


  async findRecords(req: CustomRequest, queryParams: FetchRecordDto) {
    const query: any = {
      isDeleted: false,
      ...(queryParams.status && { status: queryParams.status }),
      ...(queryParams.searchTerm && {
        $or: [{ firstName: { $regex: queryParams.searchTerm, $options: 'i' } }, { lastName: { $regex: queryParams.searchTerm, $options: 'i' } }],
      }),
    };

    const totalDocumentCount = await this.userModel.countDocuments(query);
    PaginationParamsSetup(req, totalDocumentCount);

    const users = await this.userModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((req.pagination.currentPage - 1) * req.pagination.perPage)
      .limit(req.pagination.perPage);

    return users;
  }
}
