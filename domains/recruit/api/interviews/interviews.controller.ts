import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { InterviewsService } from './interviews.service';
import { CreateInterviewSchema, UpdateInterviewSchema } from './interviews.dto';

@ApiTags('interviews')
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Get('layout/list')
  @RequirePermission('interviews.read')
  @ApiOperation({ summary: 'Get list layout config for interviews' })
  getListLayout() {
    return this.interviews.getListLayout();
  }

  @Get()
  @RequirePermission('interviews.read')
  @ApiOperation({ summary: 'List interviews' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.interviews.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('interviews.read')
  @ApiOperation({ summary: 'Get a single interview by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.interviews.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('interviews.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new interview' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateInterviewSchema.parse(body);
    return this.interviews.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('interviews.update')
  @ApiOperation({ summary: 'Update an interview' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateInterviewSchema.parse(body);
    return this.interviews.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('interviews.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete an interview' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.interviews.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('interviews.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone an interview' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.interviews.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('interviews.update')
  @ApiOperation({ summary: 'Restore a soft-deleted interview' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.interviews.restore(id);
  }
}
