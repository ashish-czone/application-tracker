import { Controller, Get, Post, Patch, Delete, Put, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { OrgPositionService } from '../services/org-position.service';
import { CreateOrgPositionDto } from '../dto/create-org-position.dto';
import { UpdateOrgPositionDto } from '../dto/update-org-position.dto';
import { SetPositionScopesDto } from '../dto/set-position-scopes.dto';
import { ORG_UNIT_PERMISSIONS } from '../permissions';

@ApiTags('org-positions')
@Controller('org-positions')
export class OrgPositionController {
  constructor(private readonly orgPositionService: OrgPositionService) {}

  @Get()
  @RequirePermission(ORG_UNIT_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List all org positions' })
  async list() {
    return this.orgPositionService.findAll();
  }

  @Get(':id')
  @RequirePermission(ORG_UNIT_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get an org position by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgPositionService.findOneOrFail(id);
  }

  @Post()
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an org position' })
  async create(@Body() body: CreateOrgPositionDto) {
    return this.orgPositionService.create(body);
  }

  @Patch(':id')
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Update an org position' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateOrgPositionDto) {
    return this.orgPositionService.update(id, body);
  }

  @Delete(':id')
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an org position' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.orgPositionService.delete(id);
  }

  @Get(':id/scopes')
  @RequirePermission(ORG_UNIT_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get scope configuration for a position' })
  async getScopes(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgPositionService.getScopes(id);
  }

  @Put(':id/scopes')
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Set scope configuration for a position (full replace)' })
  async setScopes(@Param('id', ParseUUIDPipe) id: string, @Body() body: SetPositionScopesDto) {
    return this.orgPositionService.setScopes(id, body.scopes);
  }
}
