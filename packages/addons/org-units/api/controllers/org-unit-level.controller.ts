import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { OrgUnitLevelService } from '../services/org-unit-level.service';
import { CreateOrgUnitLevelDto } from '../dto/create-org-unit-level.dto';
import { UpdateOrgUnitLevelDto } from '../dto/update-org-unit-level.dto';
import { ORG_UNIT_PERMISSIONS } from '../permissions';

@ApiTags('org-unit-levels')
@Controller('org-unit-levels')
export class OrgUnitLevelController {
  constructor(private readonly orgUnitLevelService: OrgUnitLevelService) {}

  @Get()
  @RequirePermission(ORG_UNIT_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List all org unit levels' })
  async list() {
    return this.orgUnitLevelService.findAll();
  }

  @Get(':id')
  @RequirePermission(ORG_UNIT_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get an org unit level by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgUnitLevelService.findOneOrFail(id);
  }

  @Post()
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an org unit level' })
  async create(@Body() body: CreateOrgUnitLevelDto) {
    return this.orgUnitLevelService.create(body);
  }

  @Patch(':id')
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Update an org unit level' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateOrgUnitLevelDto) {
    return this.orgUnitLevelService.update(id, body);
  }

  @Delete(':id')
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an org unit level' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.orgUnitLevelService.delete(id);
  }
}
