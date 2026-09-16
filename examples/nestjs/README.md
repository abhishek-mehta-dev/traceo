# NestJS example

Use `@traceo/nestjs` the same way as Express, because Nest's default HTTP adapter is Express-compatible.

```js
const { NestFactory } = require('@nestjs/core');
const { createTraceoExceptionFilter, createTraceoNestMiddleware } = require('@traceo/nestjs');
const { SqliteTraceStore } = require('@traceo/storage');

async function bootstrap(AppModule) {
  const store = new SqliteTraceStore();
  const app = await NestFactory.create(AppModule);
  app.use(createTraceoNestMiddleware({ sink: store }));
  app.useGlobalFilters({ catch: createTraceoExceptionFilter({ sink: store }).catch.bind(createTraceoExceptionFilter({ sink: store })) });
  await app.listen(3000, '127.0.0.1');
}
```

The package does not depend on `@nestjs/core`. Install Nest in the application, then pass the Traceo store as the sink.
