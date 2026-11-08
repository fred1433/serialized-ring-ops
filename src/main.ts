import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { Db } from './db';
import { prepareDemoDatabase } from './seed/seed';

async function main(): Promise<void> {
  const db = new Db();
  const seeded = await prepareDemoDatabase(db);
  await db.close();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.useStaticAssets(join(__dirname, '..', 'site'));
  const port = Number(process.env.PORT ?? 4104);
  await app.listen(port, '0.0.0.0');
  console.log(`Ready on http://localhost:${port} (${seeded ? 'seeded fictional orders' : 'kept existing data'})`);
}

void main();
