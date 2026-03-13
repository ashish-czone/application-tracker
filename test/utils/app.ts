import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../apps/api/src/app.module';
import cookieParser from 'cookie-parser';

export async function createTestApp() {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
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

  const { PrismaService } = await import('@packages/database');
  return {
    app,
    prisma: module.get(PrismaService),
    httpServer: app.getHttpServer(),
  };
}
