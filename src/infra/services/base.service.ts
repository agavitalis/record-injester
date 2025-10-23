import { FilterQuery, Model, UpdateQuery } from 'mongoose';
import { BaseEntity } from '../entities/base.entity';

export class BaseService<Entity extends BaseEntity> {
  constructor(private entityModel : Model<Entity>) {}

  async findOne(filter: any): Promise<Entity> {
    const item = await this.entityModel.findOne({
      ...filter,
    });

    return item;
  }
}
