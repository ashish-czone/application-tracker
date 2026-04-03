import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(65536)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
