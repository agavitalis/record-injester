import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from 'src/infra/entities/base.entity';

export type JsonCatalogDocument = HydratedDocument<JsonCatalog>;

@Schema({ timestamps: true })
export class JsonCatalog extends BaseEntity {
  @Prop({ required: true, index: true })
  source: string;

  @Prop({ required: true, index: true, min: 1 })
  version: number;

  // AJV-compatible schema for validating originalPayload
  @Prop({ type: Object, required: true })
  jsonSchema: Record<string, any>;

  // normalizedName -> JSONPath (or dot-path) into originalPayload
  @Prop({ type: Object, required: true })
  jsonMap: Record<string, string>;

  // Declarative indexes to apply on the JsonData collection ("records")
  @Prop({ type: Array, default: [] })
  indexPolicy: Array<{
    keys: Record<string, 1 | -1>;
    opts?: Record<string, any>;
  }>;
}

export const JsonCatalogSchema = SchemaFactory.createForClass(JsonCatalog);

// prevents duplicate version per source
JsonCatalogSchema.index({ source: 1, version: 1 }, { unique: true });
