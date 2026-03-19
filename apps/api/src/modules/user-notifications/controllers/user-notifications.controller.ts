import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { NotificationQueryService } from '@packages/notifications';

@ApiTags('notifications')
@Controller('notifications')
export class UserNotificationsController {
  constructor(private readonly queryService: NotificationQueryService) {}

  @Get()
  @ApiOperation({ summary: 'List current user notifications' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.queryService.listForUser(user.userId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return {
      data: result.data,
      meta: {
        total: result.total,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        totalPages: Math.ceil(result.total / (limit ? Number(limit) : 20)),
      },
    };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@CurrentUser() user: JwtPayload) {
    const count = await this.queryService.getUnreadCount(user.userId);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.queryService.markAsRead(id, user.userId);
    return { success: true };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    await this.queryService.markAllAsRead(user.userId);
    return { success: true };
  }
}
