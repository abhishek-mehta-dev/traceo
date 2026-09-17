#!/usr/bin/env node
import type { TraceEventQuery, TraceoStorage } from '@traceojs/storage';

export async function runTraceoCli(argv: string[], storage: TraceoStorage): Promise<number> {
  const [, , command, requestIdOrFirstArg, ...rest] = argv;

  if (command === 'timeline' && requestIdOrFirstArg) {
    const timeline = await storage.getTimeline(requestIdOrFirstArg);
    if (timeline.length === 0) {
      console.log(`No events found for request ${requestIdOrFirstArg}`);
      return 0;
    }

    console.log(`Timeline for ${requestIdOrFirstArg}`);
    for (const event of timeline) {
      console.log(`[${event.type}] ${event.timestamp} ${JSON.stringify(event.payload)}`);
    }
    return 0;
  }

  if (command === 'events') {
    const args = requestIdOrFirstArg === undefined ? rest : [requestIdOrFirstArg, ...rest];
    const events = await storage.query(parseEventQuery(args));
    if (events.length === 0) {
      console.log('No events found');
      return 0;
    }

    for (const event of events) {
      console.log(`[${event.type}] ${event.timestamp} ${JSON.stringify(event.payload)}`);
    }
    return 0;
  }

  printUsage();
  return 1;
}

function printUsage() {
  console.log('Usage: traceo timeline <requestId> | traceo events [--type <type>] [--method <method>] [--status <code>] [--search <term>] [--limit <count>]');
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseEventQuery(args: string[]): TraceEventQuery {
  const status = readOption(args, '--status');
  const limit = readOption(args, '--limit');
  return {
    type: readOption(args, '--type'),
    method: readOption(args, '--method'),
    search: readOption(args, '--search'),
    statusCode: status === undefined ? undefined : Number(status),
    limit: limit === undefined ? undefined : Number(limit)
  };
}
