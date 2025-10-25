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
import { queuePool } from 'src/infra/queues/bull-board-queue';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class RecordService extends BaseService<JsonData> {
  private readonly ajv = new Ajv({ allErrors: true, coerceTypes: false, allowUnionTypes: true });
  private AUTO_WIDEN_ON_TYPE_ERRORS = Env.PORT;
  private SOURCE_URLS = Env.SOURCE_URLS;
  private readonly filterBuilder: RecordFilterBuilder;
  private static isSyncInProgress = false;

  constructor(
    @InjectModel(JsonData.name)
    private readonly jsonDataModel: Model<JsonDataDocument>,

    @InjectModel(JsonCatalog.name)
    private readonly jsonCatalogModel: Model<JsonCatalogDocument>,
    private readonly engine: InjesterEngineCore,
    private readonly http: HttpService,

    @InjectQueue('record-queue')
    private readonly recordQueue: Queue,
  ) {
    super(jsonDataModel as any);
    this.filterBuilder = new RecordFilterBuilder(this.jsonCatalogModel);
    queuePool.add(recordQueue);
  }

  async findSources(): Promise<string[]> {
    return await this.jsonCatalogModel.distinct('source');
  }

  async findRecords(req: CustomRequest, params: FetchRecordDto) {
    const filter = await this.filterBuilder.buildMongoFilter(req.query as any);

    // Sorting (default newest first)
    const sortField = params.sortBy && params.sortBy !== 'ingestedAt' ? `normalizedPayload.${params.sortBy}` : 'ingestedAt';
    const sortDir: 1 | -1 = (params.sortDir ?? 'desc') === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDir };

    // Projection
    let projection: any | undefined;
    if (params.fields) {
      projection = params.fields
        .split(',')
        .map((s) => s.trim())
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
  async initiateSyncProcess() {
    if (RecordService.isSyncInProgress) return;
    RecordService.isSyncInProgress = true;
    console.log(`[${new Date().toLocaleString()}]: Initiating sync...`);
    await Promise.all(this.SOURCE_URLS.map((url) => this.recordQueue.add('sync-source', { url })));

    RecordService.isSyncInProgress = false;
    console.log(`[${new Date().toLocaleString()}]: Sync initiated...`);
    return true;
  }

  async syncSourceToJobs(url: string) {
    const source = await this.engine.getSourceFromUrl(url);
    const resp = await lastValueFrom(this.http.get(url, { responseType: 'stream' }));
    const jsonStream = resp.data.pipe(parser()).pipe(streamArray());

    const BATCH_SIZE = 500;
    const jobOpts = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 500,
      removeOnFail: false,
    };

    let batch: Array<{ name: string; data: any; opts: typeof jobOpts }> = [];

    const flush = async () => {
      if (!batch.length) return;
      await this.recordQueue.addBulk(batch);
      batch = [];
    };

    for await (const { value: item } of jsonStream) {
      batch.push({ name: 'ingest-one', data: { source, item }, opts: jobOpts });
      if (batch.length >= BATCH_SIZE) await flush();
    }
    await flush();

    return { enqueued: true, source };
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
