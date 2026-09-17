const { cpSync, mkdirSync, rmSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const source = join(__dirname, '../../../apps/dashboard/public');
const target = join(__dirname, '../public');

if (!existsSync(source)) {
  console.error('Dashboard source missing:', source);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log('Copied dashboard assets to packages/server/public');
