#!/usr/bin/env node
import { FileTraceStore, type TraceEventQuery } from '@traceo/storage';
import { join } from 'node:path';
import { homedir } from 'node:os';

const dataFile = process.env.TRACEO_DATA_FILE ?? join(homedir(), '.traceo', 'events.json');
const store = new FileTraceStore(dataFile);

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

function main() {
  const [, , command, requestIdOrFirstArg, ...rest] = process.argv;

  if (command === 'timeline' && requestIdOrFirstArg) {
    const timeline = store.getTimeline(requestIdOrFirstArg);
    if (timeline.length === 0) {
      console.log(`No events found for request ${requestIdOrFirstArg}`);
      return;
    }
    console.log(`Timeline for ${requestIdOrFirstArg}`);
    for (const event of timeline) console.log(`[${event.type}] ${event.timestamp} ${JSON.stringify(event.payload)}`);
    return;
  }

  if (command === 'events') {
    const args = requestIdOrFirstArg === undefined ? rest : [requestIdOrFirstArg, ...rest];
    const events = store.query(parseEventQuery(args));
    if (events.length === 0) {
      console.log('No events found');
      return;
    }
    for (const event of events) console.log(`[${event.type}] ${event.timestamp} ${JSON.stringify(event.payload)}`);
    return;
  }

  printUsage();
  process.exit(1);
}

main();
