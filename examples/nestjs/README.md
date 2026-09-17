# NestJS example

Use `@traceo/nestjs` the same way as Express — Nest's default HTTP adapter is Express-compatible.

```ts
import { NestFactory } from '@nestjs/core';
import { attachTraceo } from '@traceo/nestjs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const traceo = attachTraceo(app);
  if (traceo.enabled) {
    app.useGlobalFilters(traceo.exceptionFilter);
  }

  await app.listen(3000);
}
bootstrap();
```

```bash
npm install @traceo/nestjs
```

Env (same as Express):

```bash
TRACEO_ENABLED=true
TRACEO_DASHBOARD=1              # required in production
TRACEO_PATH=/traceo
TRACEO_BASIC_AUTH=user:password
TRACEO_SQLITE_FILE=./traceo.sqlite
```

Then open `http://localhost:3000/traceo/`.
