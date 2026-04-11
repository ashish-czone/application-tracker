import { Controller, Post, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { RequirePermission } from '@packages/rbac';
import { TaskClaimService } from '../services/task-claim.service';

@ApiTags('tasks')
@Controller('tasks')
export class TaskClaimController {
  constructor(private readonly claimService: TaskClaimService) {}

  @Post(':id/claim')
  @RequirePermission('tasks.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim a team-assigned task' })
  async claim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.claimService.claim(id, user.userId);
  }

  @Post(':id/unclaim')
  @RequirePermission('tasks.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release a claimed task' })
  async unclaim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.claimService.unclaim(id, user.userId);
  }
}
