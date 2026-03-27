import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransitionTaskDto {
  @ApiProperty({ example: 'in_progress', description: 'Target state to transition to' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  toState!: string;

  @ApiPropertyOptional({ example: 'Starting work on this task' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
