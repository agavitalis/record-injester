import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationParamsDto } from 'src/infra/dto/pagination-params.dto';

export class FetchRecordDto extends PaginationParamsDto {
  @ApiProperty({
    description: 'User Search Term',
    example: 'enugu',
    required: false,
  })
  @IsOptional()
  @IsString()
  public searchTerm: string;
}
