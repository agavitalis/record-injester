import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  registerDecorator,
  ValidateIf,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { Status } from '../enums/status.enum';
import { CustomRequest } from './custom-request.dto';

export function IsAfterStartDate(property: string, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isAfterStartDate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];

          if (!value || !relatedValue) return true;

          const startDate = relatedValue instanceof Date ? relatedValue : new Date(relatedValue);
          const endDate = value instanceof Date ? value : new Date(value);

          // Check if dates are valid
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return false;
          }

          return startDate <= endDate;
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          return `${args.property} must be greater than or equal to ${relatedPropertyName}`;
        },
      },
    });
  };
}

export class PaginationParamsDto {
  @ApiProperty({ required: false, name: 'currentPage', description: 'The Page Number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentPage?: number;

  @ApiProperty({ required: false, name: 'perPage', description: 'The Number of Elements per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  perPage: number;

  @ApiProperty({ 
    description: 'Start Date in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)', 
    required: false,
    example: '2025-07-01'
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date; // Return original value if invalid, let validator handle it
  })
  @IsDate({ message: 'Start Date must be a valid date' })
  startDate?: Date;

  @ApiProperty({ 
    description: 'End Date in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)', 
    required: false,
    example: '2025-07-23'
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date; // Return original value if invalid, let validator handle it
  })
  @IsDate({ message: 'End Date must be a valid date' })
  @IsAfterStartDate('startDate', {
    message: 'End Date must be greater than or equal to Start Date',
  })
  endDate?: Date;

  @ApiProperty({
    description: 'The status of the resource',
    example: 'active',
    required: false,
    enum: Status,
  })
  @IsOptional()
  @IsString()
  @IsEnum(Status)
  public status?: Status;
}

export const PaginationParamsSetup = async (req: CustomRequest, totalDocumentCount = 1) => {
  req.pagination.totalDocumentCount = totalDocumentCount;
  req.pagination.totalPages = Math.ceil(totalDocumentCount / req.pagination.perPage);
};