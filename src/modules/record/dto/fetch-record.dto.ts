import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FetchRecordDto {
  @ApiPropertyOptional({ description: 'Free-text search across all known fields', example: 'lagos' })
  @IsOptional() @IsString()
  searchText?: string;

  @ApiPropertyOptional({ description: 'Limit to a specific dataset/source', example: 'structured_generated_data' })
  @IsOptional() @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Field to sort by (dynamic normalized field or "ingestedAt")', example: 'price' })
  @IsOptional() @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], description: 'Sort direction' })
  @IsOptional() @IsEnum(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page (max 200)', example: 50 })
  @IsOptional() @Type(() => Number) @IsNumber()
  perPage?: number;

  @ApiPropertyOptional({ description: 'Projection: comma-separated normalized fields', example: 'id,city,price' })
  @IsOptional() @IsString()
  fields?: string;

  /**
   * Everything else is treated as dynamic filters.
   * Supported natural operators (no prior field knowledge required):
   *   - Exact:         ?city=~Lagos   (case-insensitive exact if prefixed with "~")
   *                    ?availability=true
   *                    ?price=500
   *   - Range:         ?minPrice=200&maxPrice=600
   *   - Contains:      ?containsCity=lag    (regex contains, case-insensitive)
   *   - In set:        ?inCountry=DE,FR,ES  (comma-separated)
   *
   * Unknown keys are parsed in the service.
   */
  [key: string]: any;
}
