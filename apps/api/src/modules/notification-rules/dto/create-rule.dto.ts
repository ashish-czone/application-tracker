import { IsString, MinLength, MaxLength, IsIn, IsOptional, IsArray, ValidateNested, IsUUID, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class RuleChannelDto {
  @ApiProperty({ example: 'email', enum: ['email', 'in_app', 'whatsapp'] })
  @IsString()
  @IsIn(['email', 'in_app', 'whatsapp'])
  channel!: string;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  templateId!: string;
}

export class CreateRuleDto {
  @ApiProperty({ example: 'Welcome notification' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'users.UserCreated' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  eventName!: string;

  @ApiProperty({ example: 'actor', enum: ['actor', 'entity_owner', 'role'] })
  @IsString()
  @IsIn(['actor', 'entity_owner', 'role'])
  recipientStrategy!: string;

  @ApiPropertyOptional({ example: { roleId: '...' } })
  @IsOptional()
  @IsObject()
  recipientConfig?: Record<string, unknown>;

  @ApiProperty({ type: [RuleChannelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleChannelDto)
  channels!: RuleChannelDto[];
}
