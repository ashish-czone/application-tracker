import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../apps/api/src/app.module';
import { correlationIdMiddleware } from '@packages/logger';
import cookieParser from 'cookie-parser';
import { DatabaseService } from '@packages/database';

export async function createTestApp() {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  app.use(correlationIdMiddleware);
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const database = module.get(DatabaseService);
  return {
    app,
    module,
    db: database.db,
    httpServer: app.getHttpServer(),
  };
}
