# NestJS Integration Guide (`@traceo/nestjs`)

The `@traceo/nestjs` package provides idiomatic NestJS HTTP request lifecycle instrumentation for Traceo.

## Installation & Setup

Add `@traceo/nestjs` and `@traceo/core` to your NestJS application dependencies.

```ts
import { Module } from '@nestjs/common';
import { TraceoModule } from '@traceo/nestjs';
import { SQLiteTraceStore } from '@traceo/storage';

const storage = new SQLiteTraceStore('./data/traceo.sqlite');

@Module({
  imports: [
    TraceoModule.forRoot({
      sink: storage,
      captureHeaders: true
    })
  ]
})
export class AppModule {}
```

## Features

- **Execution Context Inspection**: Automatically extracts controller class and handler method names as the route identifier (e.g. `UsersController.findOne`).
- **Canonical Event Creation**: Uses `@traceo/core` event factories (`REQUEST_STARTED`, `REQUEST_COMPLETED`).
- **Correlation**: Preserves `traceId` and `requestId` across NestJS handler lifecycles.
- **Middleware Option**: Provides `createTraceoNestMiddleware(options)` for HTTP middleware registration.
