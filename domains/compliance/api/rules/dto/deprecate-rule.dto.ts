import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeprecateRuleDto {
  @IsOptional()
  @IsBoolean()
  alsoCancelInFlight?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
