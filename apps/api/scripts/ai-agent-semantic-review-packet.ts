import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  createBlindPacket,
  finalizeBlindReview,
  type SemanticBlindReview,
  type SemanticProductionCapture,
} from '../src/modules/ai-agent/semantic-eval/agent-semantic-blind-review';
import { assertPrivateTemporaryCapturePath } from '../src/modules/ai-agent/semantic-eval/agent-semantic-production-capture';

const args = process.argv.slice(2);
function option(name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function readJson<T>(input: string): Promise<T> {
  return JSON.parse(
    await readFile(assertPrivateTemporaryCapturePath(input), 'utf8'),
  ) as T;
}

async function privateWrite(output: string, value: unknown): Promise<string> {
  const path = assertPrivateTemporaryCapturePath(output);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await chmod(path, 0o600);
  return path;
}

async function main(): Promise<void> {
  const capturePath = option('--capture');
  if (!capturePath) throw new Error('Missing --capture');
  const capture = await readJson<SemanticProductionCapture>(capturePath);
  const blindOutput = option('--blind-output');
  const reviewPath = option('--review');
  const submissionOutput = option('--submission-output');
  if (blindOutput && !reviewPath && !submissionOutput) {
    const path = await privateWrite(blindOutput, createBlindPacket(capture));
    process.stdout.write(`${JSON.stringify({ mode: 'blind', path })}\n`);
    return;
  }
  if (reviewPath && submissionOutput && !blindOutput) {
    const review = await readJson<SemanticBlindReview>(reviewPath);
    const submission = finalizeBlindReview(capture, review);
    const path = await privateWrite(submissionOutput, submission);
    process.stdout.write(
      `${JSON.stringify({ mode: 'finalize', path, reviewedCases: submission.items.length })}\n`,
    );
    return;
  }
  throw new Error(
    'Use either --capture ... --blind-output ... or --capture ... --review ... --submission-output ...',
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'UNKNOWN_ERROR'}\n`,
  );
  process.exitCode = 1;
});
