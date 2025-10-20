import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const baseConfig = {
          type: 'postgres' as const,
          autoLoadEntities: true,
          synchronize: false,
          logging: process.env.TYPEORM_LOGGING === 'true',
          ssl: process.env.DATABASE_SSL === 'true',
        };

        if (process.env.DATABASE_URL) {
          return {
            ...baseConfig,
            url: process.env.DATABASE_URL,
          };
        }

        return {
          ...baseConfig,
          host: process.env.DATABASE_HOST ?? 'localhost',
          port: Number(process.env.DATABASE_PORT ?? 5432),
          username: process.env.DATABASE_USER ?? 'postgres',
          password: process.env.DATABASE_PASSWORD ?? 'postgres',
          database: process.env.DATABASE_NAME ?? 'refigma',
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
