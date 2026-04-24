import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

/**
 * DTO for the domain PATCH endpoint on `ComplianceRulesController`. Only
 * allowed fields appear — `status` transitions go through the workflow
 * engine, not PATCH. The I14 immutability guard runs in the service; this
 * DTO only shape-validates.
 */
export class UpdateComplianceRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  lawId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  frequency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDayOfMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24)
  dueMonthOffset?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  gracePeriodDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32000)
  description?: string | null;
}
