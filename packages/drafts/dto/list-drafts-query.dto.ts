import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ListDraftsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;
}
