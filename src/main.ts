import { Env } from './common';
import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const PORT = Env.PORT || 7100;
  app.enableCors({
    credentials: true,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  // Swagger setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Injester Services')
    .setDescription('Injester Services API Endpoint')
    .setVersion('1.0')
    .addBearerAuth(
      {
        description: 'Injester JWT Authorization',
        type: 'http',
        in: 'header',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'JwtAuth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('/docs', app, document);

  //apply validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: true,
    }),
  );

  await app.listen(PORT);
  console.log('Injester Service listening to http://localhost:' + PORT);
}
bootstrap();
