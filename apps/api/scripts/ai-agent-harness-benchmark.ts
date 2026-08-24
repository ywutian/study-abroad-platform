import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  assertAgentHarnessBenchmark,
  runAgentHarnessBenchmark,
} from '../src/modules/ai-agent/benchmark/agent-harness-benchmark';

function parseOutputPath(args: string[]): string | undefined {
  const inline = args.find((arg) => arg.startsWith('--output='));
  if (inline) return inline.slice('--output='.length);
  const index = args.indexOf('--output');
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const report = await runAgentHarnessBenchmark();
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = parseOutputPath(process.argv.slice(2));
  if (outputPath) {
    const absolutePath = resolve(outputPath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, serialized, {
      encoding: 'utf8',
      mode: 0o600,
    });
  }
  process.stdout.write(serialized);
  assertAgentHarnessBenchmark(report);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
