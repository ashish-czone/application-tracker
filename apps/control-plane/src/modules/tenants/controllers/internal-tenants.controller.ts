import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { Public } from '@packages/auth-core';
import { ServiceAuthGuard } from '@packages/service-auth';
import { TenantRegistryService } from '@packages/tenancy';
import { UpdateTenantStatusDto } from '../dto/update-tenant-status.dto';

/**
 * Internal API for service-to-service communication.
 *
 * Called by tenant apps (e.g., recruit-app) for tenant resolution
 * at login and by provisioning scripts. Protected by ServiceAuthGuard
 * (signed JWT from trusted services), not user auth.
 */
@Public()
@UseGuards(ServiceAuthGuard)
@Controller('internal/tenants')
export class InternalTenantsController {
  constructor(private readonly tenantRegistry: TenantRegistryService) {}

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const tenant = await this.tenantRegistry.findBySlug(slug);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  @Get('by-id/:id')
  async findById(@Param('id') id: string) {
    const tenant = await this.tenantRegistry.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  @Get()
  async list(@Query('status') status?: string) {
    if (status) {
      return this.tenantRegistry.listByStatus(status);
    }
    return this.tenantRegistry.list();
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
