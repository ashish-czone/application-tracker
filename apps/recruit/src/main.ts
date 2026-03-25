import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { correlationIdMiddleware } from '@packages/logger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(correlationIdMiddleware);
  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });

  // Serve uploaded files for local media provider
  if (process.env.MEDIA_PROVIDER !== 's3') {
    const uploadPath = process.env.MEDIA_LOCAL_PATH ?? './uploads';
    (app as any).useStaticAssets(uploadPath, { prefix: '/uploads' });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Recruit API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const expressApp = app.getHttpAdapter();
  expressApp.get('/health', (_req: unknown, res: { json: (body: unknown) => void }) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const port = process.env.PORT ?? 3011;
  await app.listen(port);
}

bootstrap().catch((error) => {
  console.error('Failed to start Recruit application:', error);
  process.exit(1);
});
