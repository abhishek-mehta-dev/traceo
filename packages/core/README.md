# @traceojs/core

Core building blocks for [Traceo](https://github.com/abhishek-mehta-dev/traceo): event factories, secret redaction, and a capture sink interface.

Most apps should use [`@traceojs/express`](https://www.npmjs.com/package/@traceojs/express) or [`@traceojs/nestjs`](https://www.npmjs.com/package/@traceojs/nestjs). Depend on `@traceojs/core` only when you need custom instrumentation.

## Requirements

- Node.js 22 or newer

## Installation

```bash
npm install @traceojs/core
```

## Usage

```js
import {
  TraceoCore,
  createRequestStartedEvent,
  createRequestCompletedEvent,
  createErrorEvent
} from '@traceojs/core';

const sink = {
  async capture(event) {
    // persist or forward the event
    console.log(event.type, event.id);
  }
};

const core = new TraceoCore(sink, {
  enabled: true,
  environment: process.env.NODE_ENV || 'development'
});

await core.capture(
  createRequestStartedEvent({
    method: 'GET',
    url: '/health'
  })
);
```

## Main exports

| Export | Description |
| --- | --- |
| `TraceoCore` | Forwards events to a `TraceoEventSink` when enabled |
| `createRequestStartedEvent` | Build a `REQUEST_STARTED` event |
| `createRequestCompletedEvent` | Build a `REQUEST_COMPLETED` event |
| `createErrorEvent` | Build an `error` event |
| `errorFromUnknown` | Normalize thrown values into error details |
| Redaction helpers | Mask secrets before persistence |

## Related packages

- [`@traceojs/storage`](https://www.npmjs.com/package/@traceojs/storage) — persistence adapters
- [`@traceojs/express`](https://www.npmjs.com/package/@traceojs/express) — Express integration

## License

[MIT](https://github.com/abhishek-mehta-dev/traceo/blob/main/LICENSE)
