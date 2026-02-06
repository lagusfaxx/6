import { spawnSync } from 'node:child_process';

const checks = [
  {
    description: 'git conflict start marker',
    pattern: '^<<<<<<<\\s+',
  },
  {
    description: 'git conflict separator marker',
    pattern: '^=======$',
  },
  {
    description: 'git conflict end marker',
    pattern: '^>>>>>>>\\s+',
  },
  {
    description: 'unresolved diff hunk header',
    pattern: '^@@\\s+-[0-9,]+\\s+\\+[0-9,]+\\s+@@',
  },
];

let hasError = false;

for (const check of checks) {
  const result = spawnSync(
    'git',
    ['grep', '-n', '--cached', '--full-name', '--line-number', '-I', '-E', check.pattern, '--', '.'],
    { encoding: 'utf8' },
  );

  if (result.status === 0) {
    const output = result.stdout.trim();
    if (output.length > 0) {
      hasError = true;
      console.error(`\nFound ${check.description}:`);
      console.error(output);
    }
    continue;
  }

  if (result.status === 1) {
    continue;
  }

  throw new Error(result.stderr || `git grep failed with status ${result.status}`);
}

if (hasError) {
  console.error('\nAborting because unresolved merge/diff markers were found in tracked files.');
  process.exit(1);
}

console.log('No unresolved merge or diff markers detected in tracked files.');
