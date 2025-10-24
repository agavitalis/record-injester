import Ajv from 'ajv';
import { Env } from 'src/common';
import { Model } from 'mongoose';
import { lastValueFrom } from 'rxjs';
import { parser } from 'stream-json';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { FetchRecordDto } from './dto/fetch-record.dto';
import { BaseService } from 'src/infra/services/base.service';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CustomRequest } from 'src/infra/dto/custom-request.dto';
import { JsonData, JsonDataDocument } from './entities/json-data.entity';
import { InjesterEngineCore } from 'src/infra/core/injester-engine.core';
import { PaginationParamsSetup } from 'src/infra/dto/pagination-params.dto';
import { JsonCatalog, JsonCatalogDocument } from './entities/json-catalog.entity';
import { RecordFilterBuilder } from './helpers/record-filter.builder';

@Injectable()
export class RecordService extends BaseService<JsonData> {
  private readonly ajv = new Ajv({ allErrors: true, coerceTypes: false,  allowUnionTypes: true, });
  private AUTO_WIDEN_ON_TYPE_ERRORS = Env.PORT
  private SOURCE_URLS = Env.SOURCE_URLS
  private readonly filterBuilder: RecordFilterBuilder;

  constructor(
    @InjectModel(JsonData.name)
    private readonly jsonDataModel: Model<JsonDataDocument>,

    @InjectModel(JsonCatalog.name)
    private readonly jsonCatalogModel: Model<JsonCatalogDocument>,
    private readonly engine: InjesterEngineCore,
    private readonly http: HttpService,
  ) {
    super(jsonDataModel as any);
    this.filterBuilder = new RecordFilterBuilder(this.jsonCatalogModel);
  }

   async findSources(): Promise<string[]> {
    return await this.jsonCatalogModel.distinct('source');
  }

  async findRecords(req: CustomRequest, params: FetchRecordDto) {
    const filter = await this.filterBuilder.buildMongoFilter(req.query as any);

    // Sorting (default newest first)
    const sortField =
      params.sortBy && params.sortBy !== 'ingestedAt'
        ? `normalizedPayload.${params.sortBy}`
        : 'ingestedAt';
    const sortDir: 1 | -1 = (params.sortDir ?? 'desc') === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDir };

    // Projection
    let projection: any | undefined;
    if (params.fields) {
      projection = params.fields
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .reduce((acc, key) => {
          if (['ingestedAt', '_id', 'source', 'catalogVersion'].includes(key)) acc[key] = 1;
          else acc[`normalizedPayload.${key}`] = 1;
          return acc;
        }, {} as any);
      projection._id = 0;
      projection.source = 1;
      projection.catalogVersion = 1;
      projection.ingestedAt = 1;
    }

    // Pagination
    const page = Math.max(1, Number(params.page ?? 1));
    const perPage = Math.min(200, Math.max(1, Number(params.perPage ?? 50)));

    const total = await this.jsonDataModel.countDocuments(filter);
    PaginationParamsSetup(req, total); 

    const data = await this.jsonDataModel
      .find(filter, projection)
      .sort(sort)
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();

    return { page, perPage, total, data };
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
