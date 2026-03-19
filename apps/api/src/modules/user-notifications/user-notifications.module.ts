import { Module } from '@nestjs/common';
import { UserNotificationsController } from './controllers/user-notifications.controller';

@Module({
  controllers: [UserNotificationsController],
})
export class UserNotificationsModule {}
