import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JsonCatalog, JsonCatalogDocument } from 'src/modules/record/entities/json-catalog.entity';
import { JsonData, JsonDataDocument } from 'src/modules/record/entities/json-data.entity';

export type IndexPolicy = Array<{ keys: Record<string, 1 | -1>; opts?: Record<string, any> }>;

@Injectable()
export class InjesterEngineCore {
  constructor(
    @InjectModel(JsonCatalog.name)
    private readonly jsonCatalogModel: Model<JsonCatalogDocument>,
    @InjectModel(JsonData.name)
    private readonly jsonDataModel: Model<JsonDataDocument>,
  ) {}

  // ---------- Catalog lookups ----------
  async getLatestCatalog(source: string) {
    return this.jsonCatalogModel.findOne({ source }).sort({ version: -1 }).lean();
  }

  // ---------- Get source name from file name lookups ----------

  async getSourceFromUrl(url: string): Promise<string> {
    try {
      const u = new URL(url);
      const file = u.pathname.split('/').pop() || 'source';
      return file.replace(/\.json$/i, '');
    } catch {
      return 'source';
    }
  }

  // ---------- Initial catalog (auto-create) ----------
  async autoCreateInitialCatalog(source: string, samplePayload: Record<string, any>) {
    const paths = this.flattenKeys(samplePayload);

    const jsonMap: Record<string, string> = {};
    for (const p of paths) {
      const last = p.split('.').pop()!;
      let norm = last;
      let i = 2;
      while (jsonMap[norm]) norm = `${last}_${i++}`;
      jsonMap[norm] = `$.${p}`;
    }

    const jsonSchema = this.extendJsonSchema({}, paths);
    const indexPolicy: IndexPolicy = Object.keys(jsonMap).map((k) => ({
      keys: { [`normalizedPayload.${k}`]: 1 as 1 },
      opts: { background: true, sparse: true },
    }));

    const created = await this.jsonCatalogModel.create({
      source,
      version: 1,
      jsonSchema,
      jsonMap,
      indexPolicy,
    });

    return created.toObject();
  }

  // ---------- Drift detection → publish next version ----------
  async autoPublishNextCatalogVersion(source: string, currentVersion: number, current: JsonCatalog, unknownPaths: string[]) {
    const nextVersion = currentVersion + 1;

    const nextJsonMap: Record<string, string> = { ...(current.jsonMap || {}) };
    const nextJsonSchema = this.extendJsonSchema(current.jsonSchema || {}, unknownPaths);

    for (const p of unknownPaths) {
      const last = p.split('.').pop() as string;
      let norm = last;
      let i = 2;
      while (nextJsonMap[norm]) norm = `${last}_${i++}`;
      nextJsonMap[norm] = `$.${p}`;
    }

    const newIndexEntries = Object.keys(nextJsonMap)
      .filter((k) => !(current.jsonMap || {})[k])
      .map((k) => ({
        keys: { [`normalizedPayload.${k}`]: 1 as 1 },
        opts: { background: true, sparse: true },
      }));

    const nextIndexPolicy: IndexPolicy = [...(current.indexPolicy || []), ...newIndexEntries];

    const updated = await this.jsonCatalogModel
      .findOneAndUpdate(
        { source, version: nextVersion },
        {
          $setOnInsert: {
            source,
            version: nextVersion,
            jsonSchema: nextJsonSchema,
            jsonMap: nextJsonMap,
            indexPolicy: nextIndexPolicy,
          },
        },
        { new: true, upsert: true },
      )
      .lean();

    return updated!;
  }

  // ---------- Index application ----------
  async ensureIndexesFromPolicy(policies: IndexPolicy) {
    if (!policies?.length) return;
    const seen = new Set<string>();
    for (const p of policies) {
      const sig = JSON.stringify(p.keys);
      if (seen.has(sig)) continue;
      seen.add(sig);
      await this.jsonDataModel.collection.createIndex(p.keys, p.opts || { background: true });
    }
  }

  // ---------- Widen Schema Types on type errors ----------
  async widenSchemaFromTypeErrors(jsonSchema: any, ajvTypeErrors: any[]) {
    const schema = JSON.parse(JSON.stringify(jsonSchema || {})); // deep clone
    if (!schema.type) schema.type = 'object';
    if (!schema.properties) schema.properties = {};

    for (const e of ajvTypeErrors) {
      // e.instancePath like "/priceForNight" or "/address/zip"
      const parts = (e.instancePath || '').split('/').filter(Boolean);
      let node = schema;
      for (let i = 0; i < parts.length; i++) {
        const k = parts[i];
        node.properties ??= {};
        node.properties[k] ??= { type: 'object', properties: {} };
        if (i === parts.length - 1) {
          // widen this field
          const field = node.properties[k];
          const nextTypes = Array.isArray(field.type) ? field.type : field.type ? [field.type] : [];
          const union = Array.from(new Set([...nextTypes, 'number', 'string']));
          node.properties[k] = { ...field, type: union, pattern: '^-?\\d+(\\.\\d+)?$' };
        } else {
          node = node.properties[k];
        }
      }
    }
    return schema;
  }

  // ---------- Projection ----------
  projectWithJsonMap(payload: Record<string, any>, jsonMap: Record<string, string>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [normName, path] of Object.entries(jsonMap || {})) {
      out[normName] = this.getByPath(payload, path) ?? null;
    }
    return out;
  }

  /** "$.a.b" or "a.b" */
  getByPath(obj: any, path: string): any {
    const clean = path.startsWith('$.') ? path.slice(2) : path.replace(/^\./, '');
    return clean.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj);
  }

  // ---------- Unknown fields ----------
  getUnknownFields(payload: Record<string, any>, jsonMap: Record<string, string>): string[] {
    const knownPaths = new Set(Object.values(jsonMap || {}).map((p) => (p.startsWith('$.') ? p.slice(2) : p.replace(/^\./, ''))));
    const flattened = this.flattenKeys(payload);
    return flattened.filter((p) => !knownPaths.has(p));
  }

  flattenKeys(obj: any, prefix = ''): string[] {
    if (obj === null || typeof obj !== 'object') return [];
    const out: string[] = [];
    for (const key of Object.keys(obj)) {
      const full = prefix ? `${prefix}.${key}` : key;
      if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        out.push(...this.flattenKeys(obj[key], full));
      } else {
        out.push(full);
      }
    }
    return out;
  }

  // ---------- JSON Schema helpers ----------
  extendJsonSchema(schema: any, paths: string[]) {
    const out = { ...(schema || {}) };
    if (!out.type) out.type = 'object';
    if (!out.properties) out.properties = {};
    if (!out.required) out.required = Array.isArray(out.required) ? out.required : [];

    for (const p of paths) {
      this.assignJsonSchemaAtPath(out, p.split('.'), {
        type: ['string', 'number', 'boolean', 'object', 'array', 'null'],
      });
    }
    return out;
  }

  assignJsonSchemaAtPath(root: any, parts: string[], leafSchema: any) {
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i];
      if (!node.properties) node.properties = {};
      if (!node.properties[key]) node.properties[key] = { type: 'object', properties: {} };
      if (i === parts.length - 1) {
        node.properties[key] = leafSchema;
      } else {
        if (!node.properties[key].type) node.properties[key].type = 'object';
        if (!node.properties[key].properties) node.properties[key].properties = {};
        node = node.properties[key];
      }
    }
  }
}
