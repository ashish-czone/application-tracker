import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeactivateRegistrationDto {
  /** `YYYY-MM-DD` or any ISO-8601 datetime. Past-or-today (enforced server-side). */
  @IsISO8601()
  deactivatedAt!: string;

  @IsOptional()
  @IsBoolean()
  alsoCancelEarlier?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
