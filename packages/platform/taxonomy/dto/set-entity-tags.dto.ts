import { IsArray, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetEntityTagsDto {
  @ApiProperty({ example: 'task-tags' })
  @IsString()
  groupSlug!: string;

  @ApiProperty({ type: [String], example: ['0d7e4d8f-3c1a-4f3c-9f3f-1a2b3c4d5e6f'] })
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds!: string[];
}
