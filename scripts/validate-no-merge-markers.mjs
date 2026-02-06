import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const markerChecks = [
  {
    description: 'git conflict start marker',
    regex: /^<<<<<<<\s+/m,
  },
  {
    description: 'git conflict separator marker',
    regex: /^=======$/m,
  },
  {
    description: 'git conflict end marker',
    regex: /^>>>>>>>\s+/m,
  },
  {
    description: 'unresolved diff hunk header',
    regex: /^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m,
  },
];

const listedFiles = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
if (listedFiles.status !== 0) {
  throw new Error(listedFiles.stderr || `git ls-files failed with status ${listedFiles.status}`);
}

const files = listedFiles.stdout.split('\0').filter(Boolean);
const findings = [];

for (const filePath of files) {
  let content;

  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    // Skip files that are not valid UTF-8 text.
    continue;
  }

  const lines = content.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    for (const check of markerChecks) {
      if (check.regex.test(line)) {
        findings.push({
          description: check.description,
          filePath,
          lineNumber: index + 1,
          line,
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Found unresolved merge/diff markers in tracked files:\n');

  for (const finding of findings) {
    console.error(`- ${finding.filePath}:${finding.lineNumber} (${finding.description})`);
    console.error(`  ${finding.line}`);
  }

  process.exit(1);
}

console.log('No unresolved merge or diff markers detected in tracked files.');