import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkflowDto {
  @ApiProperty({ example: 'order-status' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'slug must be lowercase kebab-case' })
  slug!: string;

  @ApiProperty({ example: 'Order Status' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'order' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  entityType!: string;

  @ApiProperty({ example: 'status' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fieldName!: string;

  @ApiProperty({ example: 'pending' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  initialState!: string;
}
