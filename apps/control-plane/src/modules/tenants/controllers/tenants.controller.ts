import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { TenantRegistryService } from '@packages/tenancy';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';

/**
 * Admin CRUD for tenant management.
 *
 * Protected by the global AuthGuard + RbacGuard (super-admin access).
 */
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantRegistry: TenantRegistryService) {}

  @Post()
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantRegistry.create(dto);
  }

  @Get()
  async list() {
    return this.tenantRegistry.list();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const tenant = await this.tenantRegistry.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    const tenant = await this.tenantRegistry.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.tenantRegistry.update(id, dto);
  }
}
