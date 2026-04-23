import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { chromium, type Page } from 'playwright';
import { isBenchmarkEnabled } from './benchmark.config';

type TailMap = Map<string, Promise<void>>;

@Injectable()
export class BrowserRunnerService {
  private readonly logger = new Logger(BrowserRunnerService.name);
  private readonly globalTails: TailMap = new Map();
  private readonly domainTails: TailMap = new Map();

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private looksLikeLoginUrl(url: string): boolean {
    return /login|sign[-_]?in|auth/i.test(url);
  }

  private randomJitterMs(): number {
    return 2_000 + Math.floor(Math.random() * 2_001);
  }

  private async runWithTail<T>(
    key: string,
    tails: TailMap,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    let release: (() => void) | undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    tails.set(
      key,
      previous.then(() => current).catch(() => current),
    );

    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release?.();
      if (tails.get(key) === current) {
        tails.delete(key);
      }
    }
  }

  async withPage<T>(
    input: {
      adapterKey: string;
      baseUrl: string;
      headed?: boolean;
      requiresSession?: boolean;
      storageStatePath?: string;
    },
    fn: (page: Page) => Promise<T>,
  ): Promise<T> {
    if (!isBenchmarkEnabled()) {
      throw new BadRequestException(
        'External competitor benchmark is disabled. Set BENCHMARK_ENABLED=true to enable it.',
      );
    }

    if (input.adapterKey === 'mock') {
      return fn({} as Page);
    }

    if (process.env.BENCHMARK_KILL_SWITCH === 'true') {
      throw new BadRequestException('Benchmark kill switch is enabled.');
    }

    if (input.requiresSession !== false && !input.storageStatePath) {
      throw new BadRequestException(
        'Missing storageState session for competitor benchmark.',
      );
    }

    const domain = new URL(input.baseUrl).hostname;
    return this.runWithTail('__global__', this.globalTails, async () =>
      this.runWithTail(domain, this.domainTails, async () => {
        await this.sleep(this.randomJitterMs());

        const browser = await chromium.launch({
          headless: input.headed === false,
        });
        const context = await browser.newContext({
          storageState: input.storageStatePath,
        });
        const page = await context.newPage();

        page.on('framenavigated', (frame) => {
          if (frame === page.mainFrame()) {
            this.logger.log(`[${domain}] ${frame.url()}`);
          }
        });

        try {
          await page.goto(input.baseUrl, { waitUntil: 'domcontentloaded' });
          if (this.looksLikeLoginUrl(page.url())) {
            throw new BadRequestException(
              `Benchmark session appears expired for ${domain}. Please upload a fresh storageState.json.`,
            );
          }

          const result = await fn(page);

          if (this.looksLikeLoginUrl(page.url())) {
            throw new BadRequestException(
              `Benchmark session expired mid-run for ${domain}. Please upload a fresh storageState.json.`,
            );
          }
          return result;
        } finally {
          await context.close().catch(() => undefined);
          await browser.close().catch(() => undefined);
        }
      }),
    );
  }
}
