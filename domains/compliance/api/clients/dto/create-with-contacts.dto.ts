import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';

class ClientPayloadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  legalName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  websiteDomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @IsUUID()
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  postalCode?: string;

  @IsOptional()
  @IsUUID()
  addressCountryId?: string;

  @IsOptional()
  @IsUUID()
  complianceAccountManagerId?: string;

  @IsOptional()
  @IsString()
  complianceStatus?: string;

  @IsOptional()
  @IsISO8601()
  complianceOnboardedAt?: string;

  @IsOptional()
  @IsString()
  complianceNotes?: string;
}

class ContactPayloadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  primaryEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  primaryPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  complianceDesignation?: string;

  @IsOptional()
  @IsBoolean()
  complianceIsPrimary?: boolean;

  @IsOptional()
  @IsString()
  complianceNotes?: string;
}

export class CreateClientWithContactsDto {
  @ValidateNested()
  @Type(() => ClientPayloadDto)
  client!: ClientPayloadDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ContactPayloadDto)
  contacts!: ContactPayloadDto[];
}
