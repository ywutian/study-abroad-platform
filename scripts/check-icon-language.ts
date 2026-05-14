import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const webSrc = path.join(repoRoot, 'apps/web/src');

const allowedSubpaths = new Set(['components/features/chat/EmojiPicker.tsx']);

const bannedLucideNames = ['Sparkles', 'Bot', 'Brain', 'Wand2', 'WandSparkles', 'Rocket'];
const bannedLucidePattern = new RegExp(`\\b(${bannedLucideNames.join('|')})\\b`);
const emojiPattern = /[🤖✨🏆🎯📊📅📄📝❓📌🛡✅🎓⭐💡⚠🥇🥈🥉⏱]/u;
const scanExtensions = new Set(['.ts', '.tsx']);

interface Violation {
  file: string;
  line: number;
  reason: string;
  text: string;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') return [];
      return walk(fullPath);
    }

    return scanExtensions.has(path.extname(fullPath)) ? [fullPath] : [];
  });
}

const violations: Violation[] = [];

for (const file of walk(webSrc)) {
  const relativePath = path.relative(webSrc, file);
  if (allowedSubpaths.has(relativePath)) continue;

  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, index) => {
    if (bannedLucidePattern.test(line)) {
      violations.push({
        file: relativePath,
        line: index + 1,
        reason: `banned AI-feeling lucide icon (${bannedLucideNames.join(', ')})`,
        text: line.trim(),
      });
    }

    if (emojiPattern.test(line)) {
      violations.push({
        file: relativePath,
        line: index + 1,
        reason: 'emoji in UI chrome',
        text: line.trim(),
      });
    }
  });
}

if (violations.length > 0) {
  console.error('Icon language check failed:\n');
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} ${violation.reason}\n  ${violation.text}`);
  }
  process.exit(1);
}

console.log('Icon language check passed.');
