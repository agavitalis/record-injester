import { Model } from 'mongoose';
import { JsonCatalogDocument } from '../entities/json-catalog.entity';
import { RecordQueryHelper as Q } from './record-query.helper';

export class RecordFilterBuilder {
  constructor(private readonly catalogModel: Model<JsonCatalogDocument>) {}


  private async buildSearchOrClauses(searchTerm: string, source?: string) {
    const catalogFilter = source ? { source } : {};
    const catalogs = await this.catalogModel.find(catalogFilter).lean();

    const normalizedFieldNames = new Set<string>();
    for (const c of catalogs) {
      Object.keys(c.jsonMap || {}).forEach(key => normalizedFieldNames.add(key));
    }

    const paths = Array.from(normalizedFieldNames).map(key => `normalizedPayload.${key}`);
    if (!paths.length) return [];

    const regex = { $regex: searchTerm, $options: 'i' };
    return paths.map(p => ({ [p]: regex }));
  }

  /**
   * Convert a natural query object into a MongoDB filter.
   * Supported operators (no prior field knowledge required):
   *   - Exact:          ?city=~Lagos (case-insensitive exact with "~")
   *                     ?availability=true
   *                     ?price=500
   *   - Range:          ?minPrice=200&maxPrice=600
   *   - Contains:       ?containsCity=lag
   *   - In set:         ?inCountry=DE,FR,ES
   */
  async buildMongoFilter(query: Record<string, any>) {
    const reserved = new Set(['search', 'source', 'sortBy', 'sortDir', 'page', 'perPage', 'fields']);
    const filter: any = {};

    // Optional dataset scope
    if (query.source) filter.source = String(query.source);

    if (query.search) {
      const orClauses = await this.buildSearchOrClauses(String(query.search), query.source);
      if (orClauses.length) filter.$or = orClauses;
    }

    // Dynamic attributes (unknown ahead of time)
    for (const rawKey of Object.keys(query)) {
      if (reserved.has(rawKey)) continue;
      const value = query[rawKey];

      // minX / maxX → $gte / $lte
      if (rawKey.startsWith('min') && rawKey.length > 3) {
        const field = rawKey.slice(3);
        const path = `normalizedPayload.${Q.toCamel(field)}`;
        const num = Number(value);
        if (!Number.isNaN(num)) filter[path] = { ...(filter[path] || {}), $gte: num };
        continue;
      }
      if (rawKey.startsWith('max') && rawKey.length > 3) {
        const field = rawKey.slice(3);
        const path = `normalizedPayload.${Q.toCamel(field)}`;
        const num = Number(value);
        if (!Number.isNaN(num)) filter[path] = { ...(filter[path] || {}), $lte: num };
        continue;
      }

      // containsX → regex (i)
      if (rawKey.startsWith('contains') && rawKey.length > 8) {
        const field = rawKey.slice(8);
        const path = `normalizedPayload.${Q.toCamel(field)}`;
        filter[path] = { $regex: String(value), $options: 'i' };
        continue;
      }

      // inX → $in (CSV)
      if (rawKey.startsWith('in') && rawKey.length > 2) {
        const field = rawKey.slice(2);
        const path = `normalizedPayload.${Q.toCamel(field)}`;
        const items = Q.parseCsv(String(value));
        filter[path] = { $in: items.map(v => (Q.isNumeric(v) ? Number(v) : v)) };
        continue;
      }

      // Default exact:
      //  - bool/number → exact
      //  - "~Value"    → case-insensitive exact
      //  - string      → exact as-is
      {
        const path = `normalizedPayload.${rawKey}`;
        if (Q.isBoolean(value)) {
          filter[path] = Q.toBoolean(value);
        } else if (Q.isNumeric(value)) {
          filter[path] = Number(value);
        } else if (typeof value === 'string' && value.startsWith('~')) {
          const escaped = Q.escapeRegex(value.slice(1));
          filter[path] = { $regex: `^${escaped}$`, $options: 'i' };
        } else {
          filter[path] = value;
        }
      }
    }

    return filter;
  }
}
