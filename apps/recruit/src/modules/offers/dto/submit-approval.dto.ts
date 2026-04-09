import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitApprovalDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class SetApproversDto {
  @IsString({ each: true })
  approverIds!: string[];
}
