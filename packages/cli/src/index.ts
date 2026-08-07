#!/usr/bin/env node
import { FileTraceStore } from '@traceo/storage';
import { join } from 'node:path';
import { homedir } from 'node:os';

const dataFile = process.env.TRACEO_DATA_FILE ?? join(homedir(), '.traceo', 'events.json');
const store = new FileTraceStore(dataFile);

function printUsage() {
  console.log('Usage: traceo timeline <requestId>');
}

function main() {
  const [, , command, requestId] = process.argv;

  if (command !== 'timeline' || !requestId) {
    printUsage();
    process.exit(1);
  }

  const timeline = store.getTimeline(requestId);

  if (timeline.length === 0) {
    console.log(`No events found for request ${requestId}`);
    return;
  }

  console.log(`Timeline for ${requestId}`);
  for (const event of timeline) {
    console.log(`[${event.type}] ${event.timestamp} ${JSON.stringify(event.payload)}`);
  }
}

main();
