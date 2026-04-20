import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddRoleMemberDto {
  @ApiProperty({ description: 'User id to assign to the role' })
  @IsUUID()
  userId!: string;
}
