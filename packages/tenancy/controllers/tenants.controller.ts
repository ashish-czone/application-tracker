import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { TenantRegistryService } from '../services/tenant-registry.service';

class CreateTenantDto {
  slug!: string;
  name!: string;
  databaseUrl!: string;
}

class UpdateTenantStatusDto {
  status!: 'active' | 'suspended';
}

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

  @Patch(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    const tenant = await this.tenantRegistry.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');
    await this.tenantRegistry.updateStatus(id, dto.status);
  }
}
