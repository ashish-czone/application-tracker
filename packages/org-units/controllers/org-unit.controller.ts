import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { OrgUnitService } from '../services/org-unit.service';
import { CreateOrgUnitDto } from '../dto/create-org-unit.dto';
import { UpdateOrgUnitDto } from '../dto/update-org-unit.dto';
import { ORG_UNIT_PERMISSIONS } from '../permissions';

@ApiTags('org-units')
@Controller('org-units')
export class OrgUnitController {
  constructor(private readonly orgUnitService: OrgUnitService) {}

  @Get()
  @RequirePermission(ORG_UNIT_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List all org units' })
  async list() {
    return this.orgUnitService.findAll();
  }

  @Get(':id')
  @RequirePermission(ORG_UNIT_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get an org unit by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgUnitService.findOneOrFail(id);
  }

  @Post()
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an org unit' })
  async create(@Body() body: CreateOrgUnitDto) {
    return this.orgUnitService.create(body);
  }

  @Patch(':id')
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Update an org unit' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateOrgUnitDto) {
    return this.orgUnitService.update(id, body);
  }

  @Delete(':id')
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an org unit' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.orgUnitService.delete(id);
  }

  @Post(':id/members/:userId')
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Add a member to an org unit' })
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: { positionId?: string } = {},
  ) {
    await this.orgUnitService.addMember(id, userId, body.positionId);
  }

  @Patch(':id/members/:userId')
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Update a member\'s position in an org unit' })
  async updateMemberPosition(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: { positionId: string | null },
  ) {
    await this.orgUnitService.updateMemberPosition(id, userId, body.positionId);
  }

  @Delete(':id/members/:userId')
  @RequirePermission(ORG_UNIT_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from an org unit' })
  async removeMember(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    await this.orgUnitService.removeMember(id, userId);
  }

  @Get(':id/members')
  @RequirePermission(ORG_UNIT_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List members of an org unit' })
  async listMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgUnitService.getMemberIds(id);
  }
}
