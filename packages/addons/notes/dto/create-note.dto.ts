import { IsString, IsOptional, IsBoolean, IsUUID, MaxLength } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @MaxLength(100)
  entityType!: string;

  @IsUUID()
  entityId!: string;

  @IsString()
  @MaxLength(65536)
  content!: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
