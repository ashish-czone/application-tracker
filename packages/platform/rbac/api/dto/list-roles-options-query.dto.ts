import { IsOptional, IsString, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Query schema for `GET /roles/options` — typeahead picker for role
 * dropdowns. Mirrors the shape of `/clients/options` and `/laws/options`:
 * `search` ILIKEs role name; `ids` (CSV) bypasses search and hydrates labels
 * for already-selected chips when a saved filter is reopened. `limit` clamps
 * low — typeaheads don't need hundreds of rows.
 */
export class ListRolesOptionsQueryDto {
  @ApiPropertyOptional({ description: 'Search by role name (ILIKE)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated list of role IDs to hydrate (bypasses search when present).',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return undefined;
    const parts = value
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    return parts.length > 0 ? parts : undefined;
  })
  ids?: string[];

  @ApiPropertyOptional({ default: 25, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 25;

  @ApiPropertyOptional({ description: 'Optional user type filter (admin/client/etc)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  userType?: string;
}
