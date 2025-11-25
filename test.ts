import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import test from 'node:test';

const filename = url.fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const patterns = ['./test/*.ts'];

const allSource = fs
  .globSync(patterns, {
    cwd: dirname,
  })
  .map((s) => path.join(dirname, s));

const hasTestExt = (s: string) => s.endsWith('.test.ts');

// // import all non-test files
// test('~~import all non-bin source', async () => {
//   const tasks = allSource.filter((s) => !hasTestExt(s)).map((s) => import(s));
//   await Promise.all(tasks);
// });

// create test suites for all test files
allSource.forEach((s) => test(path.relative(dirname, s), () => import(s)));
