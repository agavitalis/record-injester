import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from 'src/infra/entities/base.entity';

export type JsonDataDocument = HydratedDocument<JsonData>;

@Schema({
  collection: 'records',
  timestamps: { createdAt: 'ingestedAt', updatedAt: false },
})
export class JsonData extends BaseEntity{
  @Prop({ required: true, index: true })
  source: string;

  @Prop({ required: true, min: 1 })
  catalogVersion: number;

  // exact original object
  @Prop({ type: Object, required: true })
  originalPayload: Record<string, any>;

  // flat, query-friendly projection based on JsonCatalog.jsonMap
  @Prop({ type: Object, required: true })
  normalizedPayload: Record<string, any>;
}

export const JsonDataSchema = SchemaFactory.createForClass(JsonData);

// helpful prebuilt indexes (more come from indexPolicy at runtime)
JsonDataSchema.index({ source: 1, catalogVersion: 1 });
