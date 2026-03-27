import { IsArray, ValidateNested, IsString, IsIn, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class RuleChannelEntryDto {
  @ApiProperty({ example: 'email', enum: ['email', 'in_app', 'whatsapp'] })
  @IsString()
  @IsIn(['email', 'in_app', 'whatsapp'])
  channel!: string;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  templateId!: string;
}

export class SetRuleChannelsDto {
  @ApiProperty({ type: [RuleChannelEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleChannelEntryDto)
  channels!: RuleChannelEntryDto[];
}
