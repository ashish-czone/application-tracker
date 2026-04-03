import { IsString, IsUUID, MaxLength } from 'class-validator';

export class UploadAttachmentDto {
  @IsString()
  @MaxLength(100)
  entityType!: string;

  @IsUUID()
  entityId!: string;
}
