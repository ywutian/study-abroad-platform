import { Logger } from '@nestjs/common';
import { SourceType } from '../../../common/types/enums';

export interface ScrapedEssay {
  prompt: string;
  promptZh?: string;
  wordLimit?: number;
  type?: string;
  isRequired?: boolean;
  confidence?: number;
}

export interface ScrapeResult {
  schoolName: string;
  year: number;
  essays: ScrapedEssay[];
  sourceUrl: string;
  rawContent?: string;
}

export abstract class BaseScrapeStrategy {
  protected readonly logger: Logger;
  protected readonly REQUEST_DELAY = 2000;

  constructor(name: string) {
    this.logger = new Logger(name);
  }

  abstract readonly sourceType: SourceType;
  abstract scrape(
    schoolName: string,
    year: number,
  ): Promise<ScrapeResult | null>;

  protected async fetchPage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected extractWordLimit(text: string): number | undefined {
    const patterns = [
      /(\d+)\s*words?/i,
      /(\d+)\s*word\s*limit/i,
      /limit[:\s]*(\d+)/i,
      /maximum[:\s]*(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return undefined;
  }

  protected classifyEssayType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (
      lowerPrompt.includes('why') &&
      (lowerPrompt.includes('college') ||
        lowerPrompt.includes('university') ||
        lowerPrompt.includes('school'))
    ) {
      return 'WHY_US';
    }
    if (
      lowerPrompt.includes('activity') ||
      lowerPrompt.includes('extracurricular')
    ) {
      return 'ACTIVITY';
    }
    if (lowerPrompt.length < 200) {
      return 'SHORT_ANSWER';
    }
    return 'SUPPLEMENT';
  }
}
