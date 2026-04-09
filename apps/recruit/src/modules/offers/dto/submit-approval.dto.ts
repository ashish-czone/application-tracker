import { IsIn, IsOptional, IsString, MaxLength, IsArray, ArrayMinSize, IsUUID } from 'class-validator';

export class SubmitApprovalDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class SetApproversDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  approverIds!: string[];
}
