import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const docsRoot = join(root, 'docs');
const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;
const externalTarget = /^(?:https?:|mailto:|data:|#)/i;

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  });
}

const broken = [];

for (const file of markdownFiles(docsRoot)) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(markdownLink)) {
      let target = match[1].trim();
      if (target.startsWith('<') && target.endsWith('>')) {
        target = target.slice(1, -1);
      }
      if (externalTarget.test(target)) continue;

      target = target.split('#', 1)[0];
      if (!target) continue;

      let decodedTarget;
      try {
        decodedTarget = decodeURIComponent(target);
      } catch {
        broken.push({ file, line: index + 1, target, reason: 'invalid URL encoding' });
        continue;
      }

      const resolved = resolve(dirname(file), decodedTarget);
      if (!existsSync(resolved)) {
        broken.push({ file, line: index + 1, target, reason: 'target does not exist' });
      }
    }
  }
}

for (const issue of broken) {
  const file = relative(root, issue.file);
  console.error(
    `::error file=${file},line=${issue.line}::Broken link (${issue.reason}): ${issue.target}`
  );
}

if (broken.length > 0) {
  console.error(`Found ${broken.length} broken documentation link(s).`);
  process.exit(1);
}

console.log('Documentation links: PASS');
