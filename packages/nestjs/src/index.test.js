const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const {
  attachTraceo,
  createTraceoExceptionFilter,
  createTraceoNestMiddleware
} = require(path.resolve(__dirname, '../dist/index.js'));
const { InMemoryTraceStore } = require(path.resolve(__dirname, '../../../packages/storage/dist/index.js'));

test('NestJS middleware captures HTTP lifecycle events', async () => {
  const store = new InMemoryTraceStore();
  const middleware = createTraceoNestMiddleware({ sink: store });
  const req = { method: 'GET', url: '/users', headers: {} };
  const res = new EventEmitter();
  res.statusCode = 204;
  res.getHeaders = () => ({});

  middleware(req, res, () => res.emit('finish'));
  await new Promise((resolve) => setImmediate(resolve));

  const events = await store.list();
  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'REQUEST_STARTED');
  assert.equal(events[1].type, 'REQUEST_COMPLETED');
});

test('NestJS exception filter captures request-correlated errors', async () => {
  const store = new InMemoryTraceStore();
  const filter = createTraceoExceptionFilter({ sink: store });
  await filter.catch(new Error('nestjs boom'), {
    switchToHttp() {
      return {
        getRequest: () => ({ method: 'POST', url: '/billing', traceoRequestId: 'req-nest', traceoTraceId: 'trace-nest' }),
        getResponse: () => ({ statusCode: 500 })
      };
    }
  });

  const timeline = await store.getTimeline('req-nest');
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].type, 'error');
  assert.equal(timeline[0].payload.message, 'nestjs boom');
  assert.equal(timeline[0].payload.requestId, 'req-nest');
});

test('attachTraceo wires Nest app via underlying Express instance', () => {
  const uses = [];
  const expressApp = {
    use(...args) {
      uses.push(args);
    }
  };
  const nestApp = {
    use(...args) {
      uses.push(args);
    },
    getHttpAdapter() {
      return { getInstance: () => expressApp };
    }
  };

  const prev = process.env.TRACEO_ENABLED;
  process.env.TRACEO_ENABLED = 'true';
  try {
    const attachment = attachTraceo(nestApp, {
      storage: new InMemoryTraceStore(),
      dashboard: false
    });
    assert.equal(attachment.enabled, true);
    assert.equal(typeof attachment.exceptionFilter.catch, 'function');
    assert.ok(uses.length >= 1);
  } finally {
    if (prev === undefined) delete process.env.TRACEO_ENABLED;
    else process.env.TRACEO_ENABLED = prev;
  }
});
