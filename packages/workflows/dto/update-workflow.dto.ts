import { IsString, MinLength, MaxLength, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkflowDto {
  @ApiPropertyOptional({ example: 'Order Status Workflow' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'order' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  entityType?: string;

  @ApiPropertyOptional({ example: 'status' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fieldName?: string;

  @ApiPropertyOptional({ example: 'draft' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  initialState?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Discriminator key' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  discriminatorKey?: string;

  @ApiPropertyOptional({ description: 'Discriminator value' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  discriminatorValue?: string;

  @ApiPropertyOptional({ description: 'Whether this is the default pipeline' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
