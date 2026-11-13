import { rm } from 'node:fs/promises';
import { join } from 'node:path';

const output = process.argv[2];
if (!['dist-android', 'dist-ios'].includes(output)) {
  throw new Error('Pass dist-android or dist-ios as the native build output.');
}

for (const directory of ['marketing/ads', 'marketing/social']) {
  await rm(join(output, directory), { recursive: true, force: true });
}
