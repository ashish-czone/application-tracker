import { Controller, Post, Param, Body, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { RequirePermission } from '@packages/rbac';
import { TaskClaimService } from '../services/task-claim.service';
import { ReassignTaskDto } from '../dto/reassign-task.dto';

@ApiTags('tasks')
@Controller('tasks')
export class TaskClaimController {
  constructor(private readonly claimService: TaskClaimService) {}

  @Post(':id/reassign')
  @RequirePermission('tasks.reassign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reassign a task to a different user or team' })
  async reassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignTaskDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.claimService.reassign(id, dto);
  }

  @Post(':id/pickup')
  @RequirePermission('tasks.pickup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pick up a team-assigned task for the current user' })
  async pickup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.claimService.pickup(id, user.userId);
  }

  @Post(':id/unclaim')
  @RequirePermission('tasks.pickup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release a picked-up task back to the team pool' })
  async unclaim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.claimService.unclaim(id, user.userId);
  }
}
