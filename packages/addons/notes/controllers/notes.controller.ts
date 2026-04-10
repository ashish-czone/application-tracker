import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { NOTES_PERMISSIONS } from '../permissions';
import { NotesService } from '../services/notes.service';
import { CreateNoteDto } from '../dto/create-note.dto';
import { UpdateNoteDto } from '../dto/update-note.dto';
import { ListNotesQueryDto } from '../dto/list-notes-query.dto';
import { ListMentionsQueryDto } from '../dto/list-mentions-query.dto';

@ApiTags('notes')
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @RequirePermission(NOTES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List notes for an entity' })
  list(@Query() query: ListNotesQueryDto) {
    return this.notesService.listForEntity(
      query.entityType,
      query.entityId,
      query.page,
      query.limit,
    );
  }

  @Get('mentions/me')
  @RequirePermission(NOTES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List notes mentioning the current user' })
  listMyMentions(@CurrentUser() user: JwtPayload, @Query() query: ListMentionsQueryDto) {
    return this.notesService.listMentionsForUser(user.userId, query.page, query.limit);
  }

  @Get(':id')
  @RequirePermission(NOTES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get a note by ID' })
  findById(@Param('id') id: string) {
    return this.notesService.findByIdOrFail(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(NOTES_PERMISSIONS.CREATE)
  @ApiOperation({ summary: 'Create a note' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateNoteDto) {
    return this.notesService.create({
      entityType: dto.entityType,
      entityId: dto.entityId,
      content: dto.content,
      isInternal: dto.isInternal,
      authorId: user.userId,
    });
  }

  @Patch(':id')
  @RequirePermission(NOTES_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Update a note' })
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(NOTES_PERMISSIONS.DELETE)
  @ApiOperation({ summary: 'Delete a note' })
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.notesService.softDelete(id, user.userId);
  }
}
