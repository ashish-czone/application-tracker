import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PositionScopeEntry {
  @IsString()
  entityType!: string;

  @IsString()
  scope!: string;
}

export class SetPositionScopesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionScopeEntry)
  scopes!: PositionScopeEntry[];
}
