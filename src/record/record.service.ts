import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationParamsSetup } from 'src/infra/dto/pagination-params.dto';
import { CustomRequest } from 'src/infra/dto/custom-request.dto';
import { FetchRecordDto } from './dto/fetch-record.dto';
import { BaseService } from 'src/infra/services/base.service';
import { JsonData, JsonDataDocument } from './entities/json-data.entity';
import { JsonCatalog, JsonCatalogDocument } from './entities/json-catalog.entity';
import Ajv from 'ajv';
import { InjesterEngineService } from 'src/infra/services/injester-engine.service';
import { lastValueFrom } from 'rxjs';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class RecordService extends BaseService<JsonData> {
  private readonly ajv = new Ajv({ allErrors: true, coerceTypes: false });
  private AUTO_WIDEN_ON_TYPE_ERRORS = true; // set false for strict mode

  private SOURCE_URLS = [
    "https://buenro-tech-assessment-materials.s3.eu-north-1.amazonaws.com/structured_generated_data.json",
    "https://buenro-tech-assessment-materials.s3.eu-north-1.amazonaws.com/large_generated_data.json"
  ]

  constructor(
    @InjectModel(JsonData.name)
    private readonly jsonDataModel: Model<JsonDataDocument>,

    @InjectModel(JsonCatalog.name)
    private readonly jsonCatalogModel: Model<JsonCatalogDocument>,

    private readonly engine: InjesterEngineService,
        private readonly http: HttpService,
  ) {
    super(jsonDataModel as any);
  }

  async findRecords(req: CustomRequest, queryParams: FetchRecordDto) {
    const query: any = {
      isDeleted: false,
      ...(queryParams.status && { status: queryParams.status }),
      ...(queryParams.searchTerm && {
        $or: [{ firstName: { $regex: queryParams.searchTerm, $options: 'i' } }, { lastName: { $regex: queryParams.searchTerm, $options: 'i' } }],
      }),
    };

    const totalDocumentCount = await this.jsonDataModel.countDocuments(query);
    PaginationParamsSetup(req, totalDocumentCount);

    const users = await this.jsonDataModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((req.pagination.currentPage - 1) * req.pagination.perPage)
      .limit(req.pagination.perPage);

    return users;
  }

  async syncRecords(): Promise<Record<string, { processed: number; failed: number }>> {
  const summary: Record<string, { processed: number; failed: number }> = {};

  for (const url of this.SOURCE_URLS) {
    const source = await this.engine.getSourceFromUrl(url);
    summary[source] = { processed: 0, failed: 0 };

    // Fetch as a stream via @nestjs/axios
    const resp = await lastValueFrom(this.http.get(url, { responseType: 'stream' }));

    // Parse top-level JSON array and iterate items
    const jsonStream = resp.data.pipe(parser()).pipe(streamArray());

    for await (const { value: item } of jsonStream) {
      try {
        await this.ingestRecord(source, item);
        summary[source].processed += 1;
      } catch (err) {
        summary[source].failed += 1;
        console.warn?.(`Ingest failed for ${source}: ${err?.message || err}`);
      }
    }
  }

  return summary;
}

  async ingestRecord(source: string, originalPayload: Record<string, any>) {
    // 1) Get or create initial catalog
    let catalog = await this.engine.getLatestCatalog(source);
    if (!catalog) {
      catalog = await this.engine.autoCreateInitialCatalog(source, originalPayload);
    }

    // 2) Validate payload 
    const validate = this.ajv.compile(catalog.jsonSchema || {});
    let valid = validate(originalPayload);
    if (!valid) {
      const errs = validate.errors || [];
      const typeErrs = errs.filter((e) => e.keyword === 'type');

      if (!this.AUTO_WIDEN_ON_TYPE_ERRORS) {
        throw new BadRequestException({ errors: errs, message: 'Payload failed schema validation' });
      }

      // only type errors? (no missing 'required', no wrong shape, etc.)
      const onlyTypeErrors = typeErrs.length && typeErrs.length === errs.length;
      if (!onlyTypeErrors) {
        throw new BadRequestException({ errors: errs, message: 'Payload failed schema validation' });
      }

      // widen jsonSchema (number -> number|string with numeric pattern), bump version
      const widened = this.engine.widenSchemaFromTypeErrors(catalog.jsonSchema, typeErrs);

      catalog = await this.jsonCatalogModel
        .findOneAndUpdate(
          { source, version: catalog.version + 1 },
          {
            $setOnInsert: {
              source,
              version: catalog.version + 1,
              jsonSchema: widened,
              jsonMap: catalog.jsonMap, // unchanged
              indexPolicy: catalog.indexPolicy, // unchanged
            },
          },
          { new: true, upsert: true },
        )
        .lean();

      // re-validate with widened schema
      const revalidate = this.ajv.compile(catalog.jsonSchema || {});
      valid = revalidate(originalPayload);
      if (!valid) {
        throw new BadRequestException({ errors: revalidate.errors, message: 'Validation failed after widening' });
      }
    }

    // 3) Drift detection → auto publish next version + ensure indexes
    const unknown = this.engine.getUnknownFields(originalPayload, catalog.jsonMap);
    if (unknown.length > 0) {
      catalog = await this.engine.autoPublishNextCatalogVersion(source, catalog.version, catalog as any, unknown);
      await this.engine.ensureIndexesFromPolicy(catalog.indexPolicy || []);
    }

    // 4) Normalize and insert
    const normalizedPayload = this.engine.projectWithJsonMap(originalPayload, catalog.jsonMap);
    return this.jsonDataModel.create({
      source,
      catalogVersion: catalog.version,
      originalPayload,
      normalizedPayload,
    });
  }
  
}
