import { IsIn } from 'class-validator';

export class UpdateTenantStatusDto {
  @IsIn(['active', 'suspended', 'provisioning'])
  status!: 'active' | 'suspended' | 'provisioning';
}
