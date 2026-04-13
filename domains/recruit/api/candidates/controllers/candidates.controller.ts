import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { RequirePermission } from '@packages/rbac';
import { CandidatesService } from '../services/candidates.service';
import { ListCandidatesQueryDto } from '../dto/list-candidates-query.dto';
import { CANDIDATES_PERMISSIONS } from '../permissions';

@ApiTags('candidates')
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  @RequirePermission(CANDIDATES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List candidates with pagination, search, and filtering' })
  async list(@Query() query: ListCandidatesQueryDto) {
    return this.candidatesService.list(query);
  }

  @Get(':id')
  @RequirePermission(CANDIDATES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get a single candidate by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidatesService.findOneOrFail(id);
  }

  @Post()
  @RequirePermission(CANDIDATES_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new candidate' })
  async create(@Body() body: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.candidatesService.create(body, user.userId);
  }

  @Patch(':id')
  @RequirePermission(CANDIDATES_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Update a candidate' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.candidatesService.update(id, body, user.userId);
  }

  @Delete(':id')
  @RequirePermission(CANDIDATES_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a candidate' })
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    await this.candidatesService.softDelete(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission(CANDIDATES_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Restore a soft-deleted candidate' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidatesService.restore(id);
  }

}
