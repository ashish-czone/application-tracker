import { Controller, Get, Query, ForbiddenException, BadRequestException, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UniqueCheckService } from '../services/unique-check.service';

@ApiTags('shared')
@Controller('check-unique')
export class UniqueCheckController {
  constructor(private readonly uniqueCheckService: UniqueCheckService) {}

  @Get()
  @ApiOperation({ summary: 'Check if a field value is unique for an entity' })
  @ApiQuery({ name: 'entity', required: true, example: 'users' })
  @ApiQuery({ name: 'field', required: true, example: 'email' })
  @ApiQuery({ name: 'value', required: true, example: 'john@example.com' })
  @ApiQuery({ name: 'excludeId', required: false, description: 'Exclude this ID (for edit mode)' })
  async checkUnique(
    @Query('entity') entity: string,
    @Query('field') field: string,
    @Query('value') value: string,
    @Query('excludeId') excludeId?: string,
    @Req() req?: any,
  ) {
    if (!entity || !field || !value) {
      throw new BadRequestException('entity, field, and value are required');
    }

    const requiredPermission = this.uniqueCheckService.getPermission(entity);
    if (!requiredPermission) {
      throw new BadRequestException(`Unknown entity: ${entity}`);
    }

    // Dynamic permission check — user must have read permission for this entity
    const userPermissions: Record<string, string> = req?.user?.permissions ?? {};
    if (!('*' in userPermissions) && !(requiredPermission in userPermissions)) {
      throw new ForbiddenException('You do not have permission to check this entity');
    }

    const isUnique = await this.uniqueCheckService.isUnique(entity, field, value, excludeId);

    return { unique: isUnique };
  }
}
