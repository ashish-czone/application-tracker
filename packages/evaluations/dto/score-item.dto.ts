import { IsString, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScoreItemDto {
  @ApiProperty({ example: 'Problem Solving' })
  @IsString()
  @MaxLength(100)
  criteriaName!: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @ApiPropertyOptional({ example: 'Strong analytical skills' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
