import { IsString, IsEmail, IsUUID } from 'class-validator';

export class SendOfferLetterDto {
  @IsUUID()
  templateId!: string;

  @IsEmail()
  candidateEmail!: string;
}
