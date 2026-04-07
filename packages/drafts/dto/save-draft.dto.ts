import { IsString, IsObject, MaxLength } from 'class-validator';

export class SaveDraftDto {
  @IsString()
  @MaxLength(100)
  entityType!: string;

  @IsString()
  @MaxLength(200)
  draftKey!: string;

  @IsObject()
  data!: Record<string, unknown>;
}
