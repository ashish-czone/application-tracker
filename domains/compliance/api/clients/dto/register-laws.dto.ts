import { ArrayMinSize, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterLawsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(64, { each: true })
  lawCodes!: string[];
}
